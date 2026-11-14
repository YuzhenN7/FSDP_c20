// Student: apply for a grading, with the eligibility check - PBI-14
async function apply(sessionId) {
  say('');
  try {
    await api.post('/grading-sessions/' + sessionId + '/apply');
    say('Application submitted. Status: Pending.', 'ok');
  } catch (err) {
    say(err.message, 'err');
  }
  load();
}

function actionCell(s, applied, eligibility) {
  if (applied.has(s.id)) return '<span class="badge pending">Applied</span>';
  const state = windowState(s);
  if (state === 'upcoming') return '<span class="muted">Opens ' + esc(formatDateTime(s.apply_open)) + '</span>';
  if (state === 'closed') return '<span class="badge closed">Applications closed</span>';

  const e = eligibility[s.id];
  if (e && !e.eligible) {
    return '<span class="badge rejected">Not eligible</span>' +
      e.reasons.map((r) => '<div class="reason">' + esc(r) + '</div>').join('');
  }
  return '<button class="btn small" data-apply="' + esc(s.id) + '">Apply</button>';
}

async function load() {
  try {
    const [sessions, mine] = await Promise.all([
      api.get('/grading-sessions'),
      api.get('/grading-sessions/mine'),
    ]);
    const applied = new Set(mine.map((a) => a.session_id));

    // Only show gradings that have not happened yet
    const upcoming = sessions.filter((s) => new Date(s.session_date + 'T23:59:59') >= new Date());

    // Check eligibility up front for every session the student could apply to
    const eligibility = {};
    await Promise.all(upcoming
      .filter((s) => windowState(s) === 'open' && !applied.has(s.id))
      .map(async (s) => {
        try {
          eligibility[s.id] = await api.get('/grading-sessions/' + s.id + '/eligibility');
        } catch (err) {
          eligibility[s.id] = { eligible: false, reasons: [err.message] };
        }
      }));

    renderTable('#sessions', [
      { label: 'Type', render: (s) => esc(typeLabel(s.type)) },
      { label: 'Dojo', key: 'centre_name' },
      { label: 'Venue', key: 'venue' },
      { label: 'Date and time', render: (s) => esc(sessionWhen(s)) },
      { label: 'Fee', render: (s) => esc(formatMoney(s.fee)) },
      { label: 'Apply by', render: (s) => esc(formatDateTime(s.apply_close)) },
      { label: '', render: (s) => actionCell(s, applied, eligibility) },
    ], upcoming);

    renderTable('#mine', [
      { label: 'Grading', render: (a) => esc(typeLabel(a.type) + ' - ' + a.centre_name) },
      { label: 'Date', render: (a) => esc(formatDate(a.session_date)) },
      { label: 'Applied on', render: (a) => esc(formatDate(a.applied_at)) },
      { label: 'Status', render: (a) => statusBadge(a.status) },
      { label: 'Remark', key: 'remark' },
    ], mine);
  } catch (err) {
    showError('#sessions', err);
  }
}

document.getElementById('sessions').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-apply]');
  if (!btn) return;
  btn.disabled = true;
  apply(btn.dataset.apply);
});

load();