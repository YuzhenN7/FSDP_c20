// Admin Grading results page (admin/grading.html) - SCRUM-21
//
// Three tabs:
//   1. Record results  - pick a grading session, enter the examiner panel, mark each candidate pass/fail
//   2. Results history - every saved result; a wrong one can be corrected (with a reason)
//   3. Promotion log   - every belt change made by a grading result
//
// API (backend/routes/gradingRoutes.js):
//   GET  /gradings/sessions              GET /gradings/sessions/:id      POST /gradings/sessions/:id/results
//   GET  /gradings/examiners             GET /gradings?session_id=&result=&search=
//   GET  /gradings/:id/belt-check        PUT /gradings/:id               GET /gradings/promotions?search=&centre_id=
(() => {
  const $ = (sel) => document.querySelector(sel);

  const state = {
    sessions: [],
    examiners: [],
    session: null,          // the session being recorded (with panel + candidates)
    marks: new Map(),       // application_id -> 'pass' | 'fail'
    assistants: [],         // instructor ids
    editing: null,          // the result open in the edit dialog
    beltCheck: null,
  };

  // ---------- Small helpers ----------

  function message(text, bad = false) {
    const el = $('#msg');
    el.textContent = text;
    el.classList.toggle('bad', bad);
    el.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function clearMessage() { $('#msg').hidden = true; }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // age on a given date (both 'YYYY-MM-DD')
  function ageOn(dob, onDate) {
    if (!dob) return null;
    const [by, bm, bd] = dob.slice(0, 10).split('-').map(Number);
    const [y, m, d] = onDate.slice(0, 10).split('-').map(Number);
    return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
  }

  function examinerLabel(e) {
    return e.examiner_rank ? `${e.name} (${e.examiner_rank})` : e.name;
  }
  const examinerById = (id) => state.examiners.find((e) => e.id === id);

  function debounce(fn, ms = 300) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  // ---------- Tabs ----------

  const loaded = { history: false, promotions: false };
  $('#tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    const tab = btn.dataset.tab;
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b === btn));
    ['record', 'history', 'promotions'].forEach((t) => { $('#tab-' + t).hidden = t !== tab; });
    clearMessage();
    if (tab === 'history') loadHistory();
    if (tab === 'promotions') loadPromotions();
  });

  // =====================================================================
  // 1. RECORD RESULTS
  // =====================================================================

  async function loadSessions(keepId) {
    try {
      state.sessions = await api.get('/gradings/sessions');
    } catch (err) {
      showError('#sessions', err);
      return;
    }
    const left = state.sessions.reduce((n, s) => n + (s.approved - s.recorded), 0);
    $('#todo-count').textContent = left;
    $('#todo-count').hidden = left === 0;

    if (state.sessions.length === 0) {
      $('#sessions').innerHTML = '<div class="empty">No grading session has approved candidates yet. Approve applications on the Grading applications page first.</div>';
      $('#session-card').hidden = true;
      return;
    }
    renderSessionCards(keepId);
    // open the kept session, otherwise the first one that still has candidates to record
    const today = todayISO();
    const pick = state.sessions.find((s) => s.id === keepId)
      || state.sessions.find((s) => s.approved > s.recorded && s.session_date <= today)
      || state.sessions.find((s) => s.approved > s.recorded)
      || state.sessions[0];
    openSession(pick.id);
  }

  function renderSessionCards(selectedId) {
    $('#sessions').innerHTML = state.sessions.map((s) => {
      const left = s.approved - s.recorded;
      const status = left > 0
        ? `<div class="left">${left} candidate${left === 1 ? '' : 's'} to record</div>`
        : `<div class="done">All ${s.approved} recorded</div>`;
      return `<button type="button" class="gr-sess${s.id === selectedId ? ' on' : ''}" data-session="${s.id}">
        <strong>${esc(s.name)}</strong>
        <span class="muted">${esc(formatDate(s.session_date))} · ${esc(s.centre)}</span>
        ${status}
      </button>`;
    }).join('');
  }

  $('#sessions').addEventListener('click', (e) => {
    const card = e.target.closest('[data-session]');
    if (!card) return;
    clearMessage();
    openSession(Number(card.dataset.session));
  });

  async function openSession(id) {
    document.querySelectorAll('.gr-sess').forEach((c) => c.classList.toggle('on', Number(c.dataset.session) === id));
    let session;
    try {
      session = await api.get(`/gradings/sessions/${id}`);
    } catch (err) {
      message(err.message, true);
      return;
    }
    state.session = session;
    state.marks = new Map();

    $('#s-title').textContent = `${session.name} · ${formatDate(session.session_date)}`;
    $('#s-where').textContent = [session.centre, session.venue, formatTime(session.session_time)]
      .filter((x) => x && x !== '-').join(' · ');

    const upcoming = session.session_date > todayISO();
    $('#s-upcoming').hidden = !upcoming;
    $('#s-upcoming').textContent = upcoming
      ? `This grading is on ${formatDate(session.session_date)}. Results are normally recorded after the grading has taken place.`
      : '';

    // examiner panel: what was saved for this session before, else empty
    const chief = session.panel.find((p) => p.role === 'chief');
    state.assistants = session.panel.filter((p) => p.role === 'assistant').map((p) => p.instructor_id);
    renderChief(chief ? chief.instructor_id : null);
    renderAssistants();

    $('#result-date').value = upcoming ? todayISO() : session.session_date.slice(0, 10);
    $('#result-date').max = todayISO();

    renderCandidates();
    $('#session-card').hidden = false;
  }

  // ----- examiner panel -----

  function renderChief(selectedId) {
    const opts = state.examiners.map((e) =>
      `<option value="${e.id}"${e.id === selectedId ? ' selected' : ''}>${esc(examinerLabel(e))}</option>`).join('');
    $('#chief').innerHTML = `<option value="">Choose the chief examiner</option>${opts}`;
  }

  function renderAssistants() {
    const chiefId = Number($('#chief').value) || null;
    state.assistants = state.assistants.filter((id) => id !== chiefId);
    const chips = state.assistants.map((id) => {
      const e = examinerById(id);
      return `<span class="gr-chip">${esc(e ? e.name : 'Examiner #' + id)}
        <button type="button" data-remove="${id}" aria-label="Remove ${esc(e ? e.name : '')}">✕</button></span>`;
    }).join('');
    const choices = state.examiners
      .filter((e) => e.id !== chiefId && !state.assistants.includes(e.id))
      .map((e) => `<option value="${e.id}">${esc(examinerLabel(e))}</option>`).join('');
    const select = `<select id="add-assistant" aria-label="Add assistant examiner">
      <option value="">+ Add assistant</option>${choices}</select>`;
    $('#assistants').innerHTML = chips + select;
  }

  $('#chief').addEventListener('change', renderAssistants);
  $('#assistants').addEventListener('change', (e) => {
    if (e.target.id !== 'add-assistant' || !e.target.value) return;
    state.assistants.push(Number(e.target.value));
    renderAssistants();
    $('#add-assistant').focus();
  });
  $('#assistants').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    state.assistants = state.assistants.filter((id) => id !== Number(btn.dataset.remove));
    renderAssistants();
  });

  // ----- candidates -----

  function candidateTags(c) {
    const tags = [];
    const age = ageOn(c.date_of_birth, state.session.session_date);
    if (age !== null && age < 13) tags.push('<span class="gr-tag">Child</span>');
    if (c.concession === 'student') tags.push('<span class="gr-tag">Student</span>');
    if (c.concession === 'nsf') tags.push('<span class="gr-tag">NSF</span>');
    if (c.fee_unpaid) tags.push('<span class="gr-tag warn">Fee unpaid</span>');
    return tags.join('');
  }

  function renderCandidates() {
    const list = state.session.candidates;
    $('#all-pass').hidden = list.length === 0;
    $('.gr-savebar').hidden = list.length === 0;
    $('#save-hint').hidden = list.length === 0;
    if (list.length === 0) {
      $('#candidates').innerHTML = '<div class="empty">Every candidate in this session has a result. To correct one, use Results history.</div>';
      return;
    }
    const rows = list.map((c) => {
      const id = c.application_id;
      const target = c.target_belt
        ? `<b>${esc(c.target_belt)}</b>`
        : '<span class="muted">Highest belt - nothing to grade for</span>';
      return `<tr data-app="${id}">
        <td>${esc(c.student)}${candidateTags(c)}<span class="sub">${esc(c.centre)}</span></td>
        <td>${esc(c.current_belt || '-')}<span class="arrow">→</span>${target}</td>
        <td><span class="gr-seg" role="radiogroup" aria-label="Result for ${esc(c.student)}">
          <label class="pass"><input type="radio" name="r-${id}" value="pass"${c.target_belt ? '' : ' disabled'}>Pass</label>
          <label class="fail"><input type="radio" name="r-${id}" value="fail"${c.target_belt ? '' : ' disabled'}>Fail</label>
        </span></td>
        <td><input class="notes" maxlength="300" placeholder="Optional" aria-label="Remarks for ${esc(c.student)}"></td>
        <td><input class="cert" maxlength="60" placeholder="Pass only" disabled aria-label="Certificate number for ${esc(c.student)}"></td>
      </tr>`;
    }).join('');
    $('#candidates').innerHTML = `<table class="gr-table">
      <thead><tr><th>Candidate</th><th>Grading for</th><th>Result</th><th style="width:30%">Examiner remarks</th><th>Certificate no.</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
    updateSummary();
  }

  function setMark(row, result) {
    const id = Number(row.dataset.app);
    const cert = row.querySelector('.cert');
    row.querySelectorAll('input[type="radio"]').forEach((r) => { r.checked = r.value === result; });
    if (result) state.marks.set(id, result); else state.marks.delete(id);
    cert.disabled = result !== 'pass';
    cert.placeholder = result === 'pass' ? 'e.g. ASK-2026-0414' : 'Pass only';
    updateSummary();
  }

  // clicking the selected Pass/Fail again un-marks the candidate
  let wasChecked = false;
  $('#candidates').addEventListener('pointerdown', (e) => {
    const label = e.target.closest('.gr-seg label');
    wasChecked = !!(label && label.querySelector('input').checked);
  });
  $('#candidates').addEventListener('click', (e) => {
    const input = e.target.closest('.gr-seg input');
    if (!input) return;
    const row = input.closest('tr');
    setMark(row, wasChecked ? null : input.value);
    wasChecked = false;
  });
  // keyboard (arrow keys move between radios)
  $('#candidates').addEventListener('change', (e) => {
    if (e.target.matches('.gr-seg input')) setMark(e.target.closest('tr'), e.target.value);
  });

  $('#all-pass').addEventListener('click', () => {
    document.querySelectorAll('#candidates tr[data-app]').forEach((row) => {
      if (!row.querySelector('input[value="pass"]').disabled) setMark(row, 'pass');
    });
  });

  function updateSummary() {
    const marks = [...state.marks.values()];
    const pass = marks.filter((m) => m === 'pass').length;
    const fail = marks.length - pass;
    const markable = state.session.candidates.filter((c) => c.target_belt).length;
    const unmarked = markable - marks.length;
    $('#sum').innerHTML = `<b class="g">${pass} pass</b><b class="r">${fail} fail</b>`
      + (unmarked > 0 ? `<span class="muted">${unmarked} not marked yet - they stay on this list</span>` : '');
    $('#save').textContent = marks.length ? `Save ${marks.length} result${marks.length === 1 ? '' : 's'}` : 'Save results';
    $('#save').disabled = marks.length === 0;
    $('#save-hint').textContent = pass
      ? `Saving moves the ${pass === 1 ? 'passed student' : pass + ' passed students'} up one belt. A wrong result can be corrected later in Results history.`
      : 'A wrong result can be corrected later in Results history.';
  }

  $('#save').addEventListener('click', async () => {
    clearMessage();
    const chief = Number($('#chief').value);
    if (!chief) { message('Choose the chief examiner.', true); $('#chief').focus(); return; }
    const resultDate = $('#result-date').value;
    if (!resultDate) { message('Enter the result date.', true); $('#result-date').focus(); return; }
    if (resultDate > todayISO()) { message('The result date cannot be in the future.', true); $('#result-date').focus(); return; }

    const results = [];
    document.querySelectorAll('#candidates tr[data-app]').forEach((row) => {
      const id = Number(row.dataset.app);
      const result = state.marks.get(id);
      if (!result) return;
      results.push({
        application_id: id,
        result,
        notes: row.querySelector('.notes').value.trim(),
        certificate_no: result === 'pass' ? row.querySelector('.cert').value.trim() : '',
      });
    });
    if (results.length === 0) { message('Mark at least one candidate as pass or fail.', true); return; }

    const btn = $('#save');
    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
      const saved = await api.post(`/gradings/sessions/${state.session.id}/results`, {
        chief_examiner_id: chief,
        assistant_examiner_ids: state.assistants,
        result_date: resultDate,
        results,
      });
      const parts = [`Saved ${saved.passed.length + saved.failed.length} result(s).`];
      if (saved.passed.length) parts.push(`Moved up a belt: ${saved.passed.join(', ')}.`);
      if (saved.failed.length) parts.push(`Failed: ${saved.failed.join(', ')}.`);
      if (saved.skipped.length) parts.push(`Not saved: ${saved.skipped.map((s) => `${s.student} - ${s.reason}`).join('; ')}.`);
      const sessionId = state.session.id;
      loaded.history = false;
      loaded.promotions = false;
      await loadSessions(sessionId);
      message(parts.join(' '), saved.skipped.length > 0);
    } catch (err) {
      message(err.message, true);
      updateSummary();
    }
  });

  // =====================================================================
  // 2. RESULTS HISTORY
  // =====================================================================

  let historyRows = [];

  async function loadHistory() {
    const params = new URLSearchParams();
    if ($('#h-session').value) params.set('session_id', $('#h-session').value);
    if ($('#h-result').value) params.set('result', $('#h-result').value);
    const search = $('#h-search').value.trim();
    if (search) params.set('search', search);
    try {
      historyRows = await api.get('/gradings' + (params.toString() ? '?' + params : ''));
    } catch (err) {
      showError('#history', err);
      return;
    }
    loaded.history = true;
    $('#h-count').textContent = `${historyRows.length} result${historyRows.length === 1 ? '' : 's'}`;
    if (historyRows.length === 0) {
      $('#history').innerHTML = '<div class="empty">No results match these filters.</div>';
      return;
    }
    const rows = historyRows.map((g) => {
      // examiners text is "Chief Name (chief), Other, Other"
      let examiners = '<span class="muted">Not recorded</span>';
      if (g.examiners) {
        const [first, ...rest] = g.examiners.split(', ');
        examiners = esc(first) + (rest.length ? `<span class="sub">${esc(rest.join(', '))}</span>` : '');
      }
      const edited = g.updated_at
        ? `<span class="sub edited">Edited ${esc(formatDate(g.updated_at))}${g.updated_by ? ' by ' + esc(g.updated_by) : ''}</span>`
        : '';
      const session = g.session_name
        ? `<span class="sub">${esc(g.session_name)}</span>` : '';
      return `<tr>
        <td>${esc(formatDate(g.graded_on))}${session}</td>
        <td>${esc(g.student)}${g.certificate_no ? `<span class="sub">Cert. ${esc(g.certificate_no)}</span>` : ''}</td>
        <td>${esc(g.belt)}</td>
        <td>${statusBadge(g.result)}${edited}</td>
        <td>${examiners}</td>
        <td>${esc(g.notes || '')}</td>
        <td><button type="button" class="gr-link" data-edit="${g.id}">Edit</button></td>
      </tr>`;
    }).join('');
    $('#history').innerHTML = `<table class="gr-table">
      <thead><tr><th>Date</th><th>Student</th><th>Graded for</th><th>Result</th><th>Examiners</th><th>Remarks</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  }

  function fillSessionFilter() {
    const opts = state.sessions.map((s) =>
      `<option value="${s.id}">${esc(s.name)} · ${esc(formatDate(s.session_date))}</option>`).join('');
    $('#h-session').innerHTML = `<option value="">All sessions</option>${opts}`;
  }

  $('#h-session').addEventListener('change', loadHistory);
  $('#h-result').addEventListener('change', loadHistory);
  $('#h-search').addEventListener('input', debounce(loadHistory));

  // ----- edit dialog -----

  const dialog = $('#edit-dialog');

  $('#history').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-edit]');
    if (!btn) return;
    const g = historyRows.find((r) => r.id === Number(btn.dataset.edit));
    if (!g) return;
    clearMessage();
    state.editing = g;
    state.beltCheck = null;
    $('#e-about').textContent = `${g.student} · graded for ${g.belt} · ${formatDate(g.graded_on)}`;
    dialog.querySelectorAll('input[name="e-result"]').forEach((r) => { r.checked = r.value === g.result; });
    $('#e-notes').value = g.notes || '';
    $('#e-cert').value = g.certificate_no || '';
    $('#e-reason').value = '';
    $('#e-error').hidden = true;
    $('#e-save').disabled = false;
    updateEditDialog();
    dialog.showModal();
    try {
      state.beltCheck = await api.get(`/gradings/${g.id}/belt-check`);
      updateEditDialog();
    } catch (err) {
      $('#e-error').textContent = err.message;
      $('#e-error').hidden = false;
    }
  });

  function editResult() {
    const r = dialog.querySelector('input[name="e-result"]:checked');
    return r ? r.value : null;
  }

  // what changing the result will do to the student's belt
  function updateEditDialog() {
    const g = state.editing;
    const result = editResult();
    $('#e-cert-row').hidden = result !== 'pass';
    const warn = $('#e-warn');
    const bc = state.beltCheck;
    if (!bc || result === g.result) { warn.hidden = true; return; }
    const name = g.student.split(' ')[0];
    if (bc.can_move && g.result === 'pass') {
      warn.textContent = `Changing this pass to a fail moves ${name} back from ${bc.graded_belt} to ${bc.previous_belt}. The change is added to the promotion log.`;
    } else if (bc.can_move) {
      warn.textContent = `Changing this fail to a pass moves ${name} up from ${bc.previous_belt} to ${bc.graded_belt}. The change is added to the promotion log.`;
    } else {
      warn.textContent = `${name} is now on ${bc.current_belt || 'a different belt'}, so changing this result will not move their belt. Update the belt on the Members page if it is wrong.`;
    }
    warn.hidden = false;
  }

  $('#e-result').addEventListener('change', updateEditDialog);
  $('#e-cancel').addEventListener('click', () => dialog.close());

  $('#edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const g = state.editing;
    const reason = $('#e-reason').value.trim();
    const err = $('#e-error');
    if (!reason) { err.textContent = 'Give a reason for the change.'; err.hidden = false; $('#e-reason').focus(); return; }
    const result = editResult();
    const btn = $('#e-save');
    btn.disabled = true;
    try {
      const saved = await api.put(`/gradings/${g.id}`, {
        result,
        notes: $('#e-notes').value.trim(),
        certificate_no: result === 'pass' ? $('#e-cert').value.trim() : '',
        reason,
      });
      dialog.close();
      loaded.promotions = false;
      await loadHistory();
      loadSessions(state.session && state.session.id);
      message(`Result for ${g.student} updated.` + (saved.belt_note ? ' ' + saved.belt_note : ''));
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      btn.disabled = false;
    }
  });

  // =====================================================================
  // 3. PROMOTION LOG
  // =====================================================================

  async function loadPromotions() {
    const params = new URLSearchParams();
    const search = $('#p-search').value.trim();
    if (search) params.set('search', search);
    if ($('#p-centre').value) params.set('centre_id', $('#p-centre').value);
    let rows;
    try {
      rows = await api.get('/gradings/promotions' + (params.toString() ? '?' + params : ''));
    } catch (err) {
      showError('#promotions', err);
      return;
    }
    loaded.promotions = true;
    $('#p-count').textContent = `${rows.length} change${rows.length === 1 ? '' : 's'}`;
    renderTable('#promotions', [
      { label: 'Date', render: (p) => esc(formatDate(p.changed_at)) },
      { label: 'Student', render: (p) => `${esc(p.student)}<span class="sub">${esc(p.centre || '')}</span>` },
      { label: 'Belt change', render: (p) => `${esc(p.from_belt || '-')}<span class="arrow">→</span><b>${esc(p.to_belt)}</b>` },
      { label: 'Session', render: (p) => esc(p.session || '-') },
      { label: 'Why', key: 'reason' },
      { label: 'Recorded by', render: (p) => esc(p.changed_by || '-') },
    ], rows);
    const table = document.querySelector('#promotions table');
    if (table) table.classList.add('gr-table');
  }

  $('#p-search').addEventListener('input', debounce(loadPromotions));
  $('#p-centre').addEventListener('change', loadPromotions);

  // =====================================================================
  // Start
  // =====================================================================

  (async () => {
    try {
      const [examiners, centres] = await Promise.all([
        api.get('/gradings/examiners'),
        api.get('/centres').catch(() => []),
      ]);
      state.examiners = examiners;
      $('#p-centre').innerHTML = '<option value="">All centres</option>'
        + centres.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    } catch (err) {
      message(err.message, true);
    }
    await loadSessions();
    fillSessionFilter();
  })();
})();
