// Admin dashboard: the headline numbers. Used by frontend/admin/dashboard.html
// Needs api.js, ui.js and layout.js loaded first.
// The numbers come from GET /api/reports/summary.

(async function () {
  const metric = (label, value) => `<article class="metric">${esc(label)}<strong>${esc(value)}</strong></article>`;

  try {
    const s = await api.get('/reports/summary');
    document.getElementById('metrics').innerHTML =
      metric('Centres', s.centres) +
      metric('Students', s.students) +
      metric('Classes', s.classes) +
      metric('Fees paid', formatMoney(s.paid_total)) +
      metric('Fees outstanding', formatMoney(s.unpaid_total));
  } catch (err) {
    showError('#metrics', err);
  }
})();