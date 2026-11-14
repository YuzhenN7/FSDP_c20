// Admin: create and list grading sessions

const form = document.getElementById('session-form');
const typeSelect = document.getElementById('type');
const capacity = document.getElementById('capacity');
const hint = document.getElementById('capacity-hint');
const submitBtn = document.getElementById('submit-btn');

function val(id) {
  return document.getElementById(id).value;
}

function updateCapacityRules() {
  if (typeSelect.value === 'private') {
    capacity.required = false;
    capacity.max = 4;
    capacity.placeholder = 'Up to 4';
    hint.textContent = 'Private gradings take up to 4 students (defaults to 4).';
  } else {
    capacity.required = true;
    capacity.removeAttribute('max');
    capacity.placeholder = 'e.g. 30';
    hint.textContent = 'Required for mass gradings.';
  }
}

async function loadCentres() {
  try {
    const centres = await api.get('/centres');
    document.getElementById('centre').innerHTML =
      '<option value="">Select a dojo</option>' +
      centres.map((c) => '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>').join('');
  } catch (err) {
    document.getElementById('centre').innerHTML = '<option value="">Could not load dojos</option>';
  }
}

async function loadSessions() {
  try {
    const rows = await api.get('/grading-sessions');
    renderTable('#list', [
      { label: 'Type', render: (s) => esc(typeLabel(s.type)) },
      { label: 'Dojo', key: 'centre_name' },
      { label: 'Venue', key: 'venue' },
      { label: 'Date and time', render: (s) => esc(sessionWhen(s)) },
      { label: 'Fee', render: (s) => esc(formatMoney(s.fee)) },
      { label: 'Capacity', key: 'capacity' },
      { label: 'Applications', render: (s) => esc(formatDateTime(s.apply_open) + ' to ' + formatDateTime(s.apply_close)) },
      { label: 'Window', render: (s) => statusBadge(windowState(s)) },
    ], rows);
  } catch (err) {
    showError('#list', err);
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  say('');
  submitBtn.disabled = true;
  try {
    await api.post('/grading-sessions', {
      type: val('type'),
      centre_id: Number(val('centre')),
      venue: val('venue').trim(),
      session_date: val('date'),
      session_time: val('time'),
      fee: Number(val('fee')),
      capacity: val('capacity') === '' ? undefined : Number(val('capacity')),
      apply_open: val('apply-open'),
      apply_close: val('apply-close'),
    });
    say('Session created.', 'ok');
    form.reset();
    updateCapacityRules();
    loadSessions();
  } catch (err) {
    say(err.message, 'err');
  }
  submitBtn.disabled = false;
});

typeSelect.addEventListener('change', updateCapacityRules);

updateCapacityRules();
loadCentres();
loadSessions();