// GRADING RESULTS - MODEL: the database queries. (Controllers call these; routes never touch the database.)
//
// After a grading, the examiners decide pass or fail for each candidate and hand out certificates.
// The admin then records their results here:
//   - a pass moves the student to the next belt on their ladder and adds a row to promotion_log
//   - a fail keeps the belt; the result is still saved
//   - changing a saved result is logged in grading_edits (and in promotion_log if the belt moves)
// `gradings.belt_id` is the belt the student was graded FOR.
const db = require('../config/db');

// "Mass grading (adults)" etc.
const SESSION_NAME = `CASE gs.type WHEN 'mass_adult' THEN 'Mass grading (adults)'
                                   WHEN 'mass_children' THEN 'Mass grading (children)'
                                   ELSE 'Private grading' END`;

// The examiner panel of a session as one line of text, chief first: "A. Tan (chief), R. Lim, A. Lee"
const PANEL_TEXT = (sessionColumn) => `(
  SELECT string_agg(i.name || CASE WHEN ge.role = 'chief' THEN ' (chief)' ELSE '' END, ', '
                    ORDER BY ge.role = 'chief' DESC, i.name)
  FROM grading_examiners ge JOIN instructors i ON i.id = ge.instructor_id
  WHERE ge.session_id = ${sessionColumn})`;

// ---------- Sessions waiting for results ----------

// Every grading session with approved candidates, and how many of them still need a result.
// Order: sessions with results still to record, past gradings before upcoming ones, newest first.
async function listSessions() {
  const { rows } = await db.query(
    `SELECT gs.id, gs.type, ${SESSION_NAME} AS name, gs.session_date::text AS session_date,
            gs.session_time::text AS session_time, gs.venue, c.name AS centre,
            COUNT(a.id)::int AS approved,
            COUNT(g.id)::int AS recorded
     FROM grading_sessions gs
     JOIN centres c ON c.id = gs.centre_id
     JOIN grading_applications a ON a.session_id = gs.id AND a.status = 'approved'
     LEFT JOIN gradings g ON g.application_id = a.id
     GROUP BY gs.id, c.name
     ORDER BY (COUNT(a.id) > COUNT(g.id)) DESC,       -- sessions with results still to record first
              (gs.session_date <= CURRENT_DATE) DESC,       -- gradings that already happened before upcoming ones
              gs.session_date DESC`
  );
  return rows;
}

// One session: its details, its saved examiner panel, and the approved candidates with no result yet.
// Each candidate comes with the belt they hold now and the next belt up their ladder.
async function getSession(sessionId) {
  const session = await db.query(
    `SELECT gs.id, gs.type, ${SESSION_NAME} AS name, gs.session_date::text AS session_date,
            gs.session_time::text AS session_time, gs.venue, c.name AS centre
     FROM grading_sessions gs JOIN centres c ON c.id = gs.centre_id
     WHERE gs.id = $1`,
    [sessionId]
  );
  if (session.rows.length === 0) return null;

  const [panel, candidates] = await Promise.all([
    db.query(
      `SELECT ge.instructor_id, ge.role FROM grading_examiners ge WHERE ge.session_id = $1 ORDER BY ge.role DESC`,
      [sessionId]
    ),
    db.query(
      `SELECT a.id AS application_id, s.id AS student_id, u.name AS student, c.name AS centre,
              s.date_of_birth::text AS date_of_birth, s.concession,
              cb.name AS current_belt, nb.name AS target_belt,
              EXISTS (SELECT 1 FROM fees f WHERE f.grading_application_id = a.id AND f.status = 'unpaid') AS fee_unpaid
       FROM grading_applications a
       JOIN students s ON s.id = a.student_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN centres c ON c.id = s.centre_id
       LEFT JOIN belt_levels cb ON cb.id = s.belt_id
       LEFT JOIN belt_levels nb ON nb.sort_order = cb.sort_order + 1
       WHERE a.session_id = $1 AND a.status = 'approved'
         AND NOT EXISTS (SELECT 1 FROM gradings g WHERE g.application_id = a.id)
       ORDER BY cb.sort_order, u.name`,
      [sessionId]
    ),
  ]);
  return { ...session.rows[0], panel: panel.rows, candidates: candidates.rows };
}

// Instructors for the examiner dropdowns: examiners (with a rank) first, then everyone else
async function listExaminers() {
  const { rows } = await db.query(
    `SELECT i.id, i.name, i.examiner_rank, c.name AS centre
     FROM instructors i LEFT JOIN centres c ON c.id = i.centre_id
     ORDER BY (i.examiner_rank IS NULL), i.examiner_rank DESC, i.name`
  );
  return rows;
}

// ---------- Recording results ----------

// Save results for one session in one go (all or nothing).
//   panel:   { chief: instructorId, assistants: [instructorId, ...] }  - replaces the session's saved panel
//   results: [{ application_id, result: 'pass'|'fail', notes, certificate_no }]
// Returns { passed: [names], failed: [names], skipped: [{ student, reason }] }
async function recordResults(sessionId, panel, resultDate, results, adminId) {
  return db.transaction(async (q) => {
    // 1. each candidate
    const passed = [];
    const failed = [];
    const skipped = [];
    for (const r of results) {
      const { rows } = await q(
        `SELECT a.id, s.id AS student_id, u.name AS student, s.belt_id AS current_belt_id,
                nb.id AS target_belt_id, nb.name AS target_belt
         FROM grading_applications a
         JOIN students s ON s.id = a.student_id
         JOIN users u ON u.id = s.user_id
         LEFT JOIN belt_levels cb ON cb.id = s.belt_id
         LEFT JOIN belt_levels nb ON nb.sort_order = cb.sort_order + 1
         WHERE a.id = $1 AND a.session_id = $2 AND a.status = 'approved'
           AND NOT EXISTS (SELECT 1 FROM gradings g WHERE g.application_id = a.id)
         FOR UPDATE OF a`,
        [r.application_id, sessionId]
      );
      const c = rows[0];
      if (!c) { skipped.push({ student: `Application ${r.application_id}`, reason: 'Not an approved candidate of this session, or already recorded.' }); continue; }
      if (!c.target_belt_id) { skipped.push({ student: c.student, reason: 'Already on the top belt of the ladder.' }); continue; }

      const grading = await q(
        `INSERT INTO gradings (student_id, belt_id, result, graded_on, notes, session_id, application_id,
                               certificate_no, recorded_by, recorded_at)
         VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, now()) RETURNING id`,
        [c.student_id, c.target_belt_id, r.result, resultDate, r.notes, sessionId, c.id,
          r.result === 'pass' ? r.certificate_no : null, adminId]
      );
      if (r.result === 'pass') {
        await q('UPDATE students SET belt_id = $2 WHERE id = $1', [c.student_id, c.target_belt_id]);
        await q(
          `INSERT INTO promotion_log (student_id, from_belt_id, to_belt_id, grading_id, session_id, reason, changed_by)
           VALUES ($1, $2, $3, $4, $5, 'Passed grading', $6)`,
          [c.student_id, c.current_belt_id, c.target_belt_id, grading.rows[0].id, sessionId, adminId]
        );
        passed.push(c.student);
      } else {
        failed.push(c.student);
      }
    }

    // 2. the examiner panel - only when something was actually recorded, so a save that
    //    records nothing changes nothing
    if (passed.length + failed.length > 0) {
      await q('DELETE FROM grading_examiners WHERE session_id = $1', [sessionId]);
      await q(`INSERT INTO grading_examiners (session_id, instructor_id, role) VALUES ($1, $2, 'chief')`, [sessionId, panel.chief]);
      for (const id of panel.assistants) {
        if (id === panel.chief) continue;
        await q(`INSERT INTO grading_examiners (session_id, instructor_id, role) VALUES ($1, $2, 'assistant')`, [sessionId, id]);
      }
    }
    return { passed, failed, skipped };
  });
}

// ---------- Results history ----------

const RESULT_SELECT = `
  SELECT g.id, g.graded_on::text AS graded_on, g.result, g.notes, g.certificate_no,
         g.student_id, u.name AS student, c.name AS centre, b.name AS belt,
         g.session_id, CASE WHEN gs.id IS NULL THEN NULL ELSE ${SESSION_NAME} END AS session_name, gs.session_date::text AS session_date,
         ${PANEL_TEXT('g.session_id')} AS examiners,
         ru.name AS recorded_by, g.updated_at, uu.name AS updated_by
  FROM gradings g
  JOIN students s ON s.id = g.student_id
  JOIN users u ON u.id = s.user_id
  LEFT JOIN centres c ON c.id = s.centre_id
  JOIN belt_levels b ON b.id = g.belt_id
  LEFT JOIN grading_sessions gs ON gs.id = g.session_id
  LEFT JOIN users ru ON ru.id = g.recorded_by
  LEFT JOIN users uu ON uu.id = g.updated_by`;

// list results, newest first. Filters are optional: sessionId, result ('pass'/'fail'), search (student name)
async function listGradings({ sessionId = null, result = null, search = null } = {}) {
  const { rows } = await db.query(
    `${RESULT_SELECT}
     WHERE ($1::int IS NULL OR g.session_id = $1::int)
       AND ($2::text IS NULL OR g.result = $2)
       AND ($3::text IS NULL OR u.name ILIKE '%' || $3 || '%')
     ORDER BY g.graded_on DESC, g.id DESC`,
    [sessionId, result, search]
  );
  return rows;
}

async function getGrading(id) {
  const { rows } = await db.query(`${RESULT_SELECT} WHERE g.id = $1`, [id]);
  return rows[0];
}

// What changing this result would do to the student's belt, so the page can warn before saving.
// Returns { current_belt, graded_belt, previous_belt, belt_now_matches } or null.
async function getBeltContext(id, q = db.query.bind(db)) {
  const { rows } = await q(
    `SELECT g.id, g.result, g.notes, g.certificate_no, g.student_id, g.session_id,
            s.belt_id AS current_belt_id, cb.name AS current_belt,
            gb.id AS graded_belt_id, gb.name AS graded_belt,
            pb.id AS previous_belt_id, pb.name AS previous_belt
     FROM gradings g
     JOIN students s ON s.id = g.student_id
     LEFT JOIN belt_levels cb ON cb.id = s.belt_id
     JOIN belt_levels gb ON gb.id = g.belt_id
     LEFT JOIN belt_levels pb ON pb.sort_order = gb.sort_order - 1 AND pb.track = gb.track
     WHERE g.id = $1`,
    [id]
  );
  return rows[0] || null;
}

// Change a saved result. Moves the belt when the result flips, but only if the student is still on the
// belt that result left them on (otherwise the belt is left alone and `beltNote` says why).
// Returns { beltNote } or null if the result does not exist.
async function editGrading(id, { result, notes, certificateNo, reason }, adminId) {
  return db.transaction(async (q) => {
    const g = await getBeltContext(id, q);
    if (!g) return null;
    let beltNote = '';

    if (g.result !== result) {
      // pass -> fail: back to the belt before the graded one.  fail -> pass: up to the graded belt.
      const from = result === 'fail' ? g.graded_belt_id : g.previous_belt_id;
      const to = result === 'fail' ? g.previous_belt_id : g.graded_belt_id;
      const fromName = result === 'fail' ? g.graded_belt : g.previous_belt;
      const toName = result === 'fail' ? g.previous_belt : g.graded_belt;
      if (from && to && g.current_belt_id === from) {
        await q('UPDATE students SET belt_id = $2 WHERE id = $1', [g.student_id, to]);
        await q(
          `INSERT INTO promotion_log (student_id, from_belt_id, to_belt_id, grading_id, session_id, reason, changed_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [g.student_id, from, to, id, g.session_id,
            `Result corrected: ${g.result} to ${result}. ${reason}`.slice(0, 250), adminId]
        );
        beltNote = `Belt changed from ${fromName} to ${toName}.`;
      } else {
        beltNote = `Belt not changed: the student is now on ${g.current_belt || 'no belt'}, not ${fromName || 'the expected belt'}.`;
      }
    }

    const cert = result === 'pass' ? certificateNo : null;
    await q(
      `UPDATE gradings SET result = $2, notes = $3, certificate_no = $4, updated_by = $5, updated_at = now()
       WHERE id = $1`,
      [id, result, notes, cert, adminId]
    );
    await q(
      `INSERT INTO grading_edits (grading_id, edited_by, old_result, new_result, old_notes, new_notes,
                                  old_certificate_no, new_certificate_no, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, adminId, g.result, result, g.notes, notes, g.certificate_no, cert, reason]
    );
    return { beltNote };
  });
}

// ---------- Promotion log ----------

async function listPromotions({ search = null, centreId = null } = {}) {
  const { rows } = await db.query(
    `SELECT p.id, p.changed_at, u.name AS student, c.name AS centre,
            fb.name AS from_belt, tb.name AS to_belt,
            CASE WHEN p.session_id IS NULL THEN NULL
                 ELSE ${SESSION_NAME} || ', ' || to_char(gs.session_date, 'FMDD Mon YYYY') END AS session,
            p.reason, cu.name AS changed_by
     FROM promotion_log p
     JOIN students s ON s.id = p.student_id
     JOIN users u ON u.id = s.user_id
     LEFT JOIN centres c ON c.id = s.centre_id
     LEFT JOIN belt_levels fb ON fb.id = p.from_belt_id
     LEFT JOIN belt_levels tb ON tb.id = p.to_belt_id
     LEFT JOIN grading_sessions gs ON gs.id = p.session_id
     LEFT JOIN users cu ON cu.id = p.changed_by
     WHERE ($1::text IS NULL OR u.name ILIKE '%' || $1 || '%')
       AND ($2::int IS NULL OR s.centre_id = $2::int)
     ORDER BY p.changed_at DESC, p.id DESC`,
    [search, centreId]
  );
  return rows;
}

module.exports = {
  listSessions, getSession, listExaminers, recordResults,
  listGradings, getGrading, getBeltContext, editGrading, listPromotions,
};
