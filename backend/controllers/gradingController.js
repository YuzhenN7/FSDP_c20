// GRADING RESULTS - CONTROLLER: reads the request, calls the model, sends the answer.
const gradingModel = require('../models/gradingModel');

const RESULTS = ['pass', 'fail'];
const text = (value, max = 300) => String(value == null ? '' : value).trim().slice(0, max);
const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ---------- GET /api/gradings?session_id=&result=&search= ----------  results history
async function listGradings(req, res) {
  const result = text(req.query.result, 10).toLowerCase();
  if (result && !RESULTS.includes(result)) return res.status(400).json({ error: 'Result must be pass or fail.' });
  res.json(await gradingModel.listGradings({
    sessionId: parseId(req.query.session_id),
    result: result || null,
    search: text(req.query.search, 80) || null,
  }));
}

// ---------- GET /api/gradings/sessions ----------  sessions with approved candidates
async function listSessions(req, res) {
  res.json(await gradingModel.listSessions());
}

// ---------- GET /api/gradings/sessions/:id ----------  one session, its panel and candidates to record
async function getSession(req, res) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid session id.' });
  const session = await gradingModel.getSession(id);
  if (!session) return res.status(404).json({ error: 'Grading session not found.' });
  res.json(session);
}

// ---------- GET /api/gradings/examiners ----------
async function listExaminers(req, res) {
  res.json(await gradingModel.listExaminers());
}

// ---------- POST /api/gradings/sessions/:id/results ----------
// { chief_examiner_id, assistant_examiner_ids: [], result_date,
//   results: [{ application_id, result, notes, certificate_no }] }
async function recordResults(req, res) {
  const sessionId = parseId(req.params.id);
  if (!sessionId) return res.status(400).json({ error: 'Invalid session id.' });

  const chief = parseId(req.body.chief_examiner_id);
  if (!chief) return res.status(400).json({ error: 'Choose the chief examiner.' });
  const assistantsIn = Array.isArray(req.body.assistant_examiner_ids) ? req.body.assistant_examiner_ids : [];
  const assistants = [...new Set(assistantsIn.map(parseId))];
  if (assistants.includes(null)) return res.status(400).json({ error: 'Invalid assistant examiner.' });

  const resultDate = req.body.result_date;
  if (!isDate(resultDate)) return res.status(400).json({ error: 'Enter the result date.' });

  if (!Array.isArray(req.body.results) || req.body.results.length === 0) {
    return res.status(400).json({ error: 'Mark at least one candidate as pass or fail.' });
  }
  if (req.body.results.length > 200) return res.status(400).json({ error: 'Too many results in one save.' });
  const results = [];
  const seen = new Set();
  for (const r of req.body.results) {
    const applicationId = parseId(r && r.application_id);
    const result = text(r && r.result, 10).toLowerCase();
    if (!applicationId || !RESULTS.includes(result)) {
      return res.status(400).json({ error: 'Every result must be pass or fail.' });
    }
    if (seen.has(applicationId)) continue;
    seen.add(applicationId);
    results.push({
      application_id: applicationId,
      result,
      notes: text(r.notes) || null,
      certificate_no: text(r.certificate_no, 60) || null,
    });
  }

  if (!(await gradingModel.getSession(sessionId))) return res.status(404).json({ error: 'Grading session not found.' });
  try {
    const saved = await gradingModel.recordResults(
      sessionId, { chief, assistants }, resultDate, results, req.user.id
    );
    if (saved.passed.length + saved.failed.length === 0) {
      return res.status(409).json({ error: 'Nothing was saved. ' + saved.skipped.map((s) => `${s.student}: ${s.reason}`).join(' ') });
    }
    res.status(201).json(saved);
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'One of the examiners does not exist.' });
    if (err.code === '23505') return res.status(409).json({ error: 'A result for one of these candidates was just saved by someone else. Reload and try again.' });
    throw err;
  }
}

// ---------- PUT /api/gradings/:id   { result, notes, certificate_no, reason } ----------
async function editGrading(req, res) {
  const id = parseId(req.params.id);
  const result = text(req.body.result, 10).toLowerCase();
  const reason = text(req.body.reason, 200);
  if (!id) return res.status(400).json({ error: 'Invalid result id.' });
  if (!RESULTS.includes(result)) return res.status(400).json({ error: 'Result must be pass or fail.' });
  if (!reason) return res.status(400).json({ error: 'Give a reason for the change.' });

  const changed = await gradingModel.editGrading(id, {
    result,
    notes: text(req.body.notes) || null,
    certificateNo: text(req.body.certificate_no, 60) || null,
    reason,
  }, req.user.id);
  if (!changed) return res.status(404).json({ error: 'Result not found.' });
  res.json({ ...(await gradingModel.getGrading(id)), belt_note: changed.beltNote });
}

// ---------- GET /api/gradings/:id/belt-check ----------  what editing this result would do to the belt
async function beltCheck(req, res) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid result id.' });
  const g = await gradingModel.getBeltContext(id);
  if (!g) return res.status(404).json({ error: 'Result not found.' });
  res.json({
    result: g.result, current_belt: g.current_belt, graded_belt: g.graded_belt, previous_belt: g.previous_belt,
    // a flip only moves the belt while the student is still where this result left them
    can_move: g.result === 'pass' ? g.current_belt_id === g.graded_belt_id && !!g.previous_belt_id
                                  : g.current_belt_id === g.previous_belt_id,
  });
}

// ---------- GET /api/gradings/promotions?search=&centre_id= ----------
async function listPromotions(req, res) {
  res.json(await gradingModel.listPromotions({
    search: text(req.query.search, 80) || null,
    centreId: parseId(req.query.centre_id),
  }));
}

module.exports = {
  listGradings, listSessions, getSession, listExaminers, recordResults, editGrading, beltCheck, listPromotions,
};
