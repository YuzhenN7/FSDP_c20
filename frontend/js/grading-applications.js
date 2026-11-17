// Admin: review grading applications - PBI-15
const list = document.getElementById('list');
const rejectCard = document.getElementById('reject-card');
let rejectId = null;

function rowActions(a) {
  if (a.status !== 'pending') return esc(a.remark || '');
  const full = a.approved_count >= a.capacity;
  return '<div class="row-actions">' +
    '<button class="btn small" data-approve="' + esc(a.id) + '"' +
      (full ? ' disabled title="This session is full"' : '') + '>' + (full ? 'Session full' : 'Approve') + '</button>' +
    '<button class="btn small danger" data-reject="' + esc(a.id) + '" data-name="' + esc(a.student) + '">Reject</button>' +
    '</div>';
}

// Warn about sessions that are full but still have pending applications
function showFullNotice(rows) {
  const full = {};
  rows.filter((a) => a.status === 'pending' && a.approved_count >= a.capacity).forEach((a) => {
    full[a.session_id] = typeLabel(a.type) + ', ' + a.centre_name + ', ' + formatDate(a.session_date) +
      ' (' + a.approved_count + ' / ' + a.capacity + ')';
  });
  const names = Object.values(full);
  document.getElementById('full-notice').innerHTML = names.length
    ? '<div class="notice warn">Full: ' + names.map(esc).join('; ') + '. Approval is blocked for these sessions.</div>'
    : '';
}

async function load() {
  try {
    const status = document.getElementById('filter').value;
    const rows = await api.get('/grading-sessions/applications' + (status ? '?status=' + status : ''));
    showFullNotice(rows);
    renderTable('#list', [
      { label: 'Student', key: 'student' },
      { label: 'Belt', key: 'belt' },
      { label: 'Membership', render: (a) => statusBadge(a.membership_status || '-') },
      { label: 'Eligibility', render: (a) => statusBadge(a.eligibility_result) },
      { label: 'Session', render: (a) => esc(typeLabel(a.type) + ', ' + a.centre_name + ', ' + formatDate(a.session_date)) },
      { label: 'Applied', render: (a) => esc(formatDate(a.applied_at)) },
      { label: 'Status', render: (a) => statusBadge(a.status) },
      { label: '', render: rowActions },
    ], rows);
  } catch (err) {
    showError('#list', err);
  }
}

async function review(id, action, remark) {
  say('');
  try {
    await api.request('PATCH', '/grading-sessions/applications/' + id, { action: action, remark: remark });
    say('Application ' + action + '. The student has been emailed.', 'ok');
    closeReject();
  } catch (err) {
    say(err.message, 'err');  
  }
  load();
}

function openReject(id, name) {
  rejectId = id;
  document.getElementById('reject-title').textContent = 'Reject application: ' + name;
  document.getElementById('remark').value = '';
  rejectCard.hidden = false;
  rejectCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeReject() {
  rejectId = null;
  rejectCard.hidden = true;
}

list.addEventListener('click', (e) => {
  const approve = e.target.closest('[data-approve]');
  const reject = e.target.closest('[data-reject]');
  if (approve) review(approve.dataset.approve, 'approved');
  if (reject) openReject(reject.dataset.reject, reject.dataset.name);
});

document.getElementById('confirm-reject').addEventListener('click', () => {
  const remark = document.getElementById('remark').value.trim();
  if (!remark) return say('Please enter a remark to reject.', 'err');
  review(rejectId, 'rejected', remark);
});
document.getElementById('cancel-reject').addEventListener('click', closeReject);
document.getElementById('filter').addEventListener('change', load);

load();