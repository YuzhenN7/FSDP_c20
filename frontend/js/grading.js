/*PBI-10*/
const TYPE_LABEL = {
  mass_adult: 'Mass (Adult)',
  mass_children: 'Mass (Children)',
  private: 'Private',
};

function typeLabel(type) {
  return TYPE_LABEL[type] || type;
}

function windowState(session) {
  const now = new Date();
  if (now < new Date(session.apply_open)) return 'upcoming';
  if (now > new Date(session.apply_close)) return 'closed';
  return 'open';
}

function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d)) return String(value);
  return d.toLocaleString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function sessionWhen(session) {
  return formatDate(session.session_date) + ', ' + formatTime(session.session_time);
}

function say(text, kind) {
  const el = document.getElementById('msg');
  if (!el) return;
  el.textContent = text || '';
  el.className = text ? 'notice ' + (kind || 'ok') : '';
}