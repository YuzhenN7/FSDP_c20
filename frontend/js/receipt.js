(async () => {
  const box = document.getElementById('receipt');
  const id = new URLSearchParams(location.search).get('id');
  try {
    const p = await api.get('/student/payments/' + encodeURIComponent(id));
    const when = new Date(p.paid_at);
    const time = when.toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' });
    const method = p.method === 'online' ? 'Online' : esc(p.method);
    box.innerHTML = `
      <div class="rc-head"><h1>Payment Receipt</h1>${statusBadge('paid')}</div>
      <div class="rc-org">
        <div><h3>Aikido Shinjukai</h3><span class="muted">HQ Dojo &amp; Administration, Singapore</span></div>
        <div class="right">Date: ${esc(formatDate(p.paid_at))}<br>Time: ${esc(time)}</div>
      </div>
      <div class="rc-bill">
        Billed to: ${esc(p.student_name)}<br>
        Email: ${esc(p.student_email)}<br>
        Dojo branch: ${esc(p.centre || '-')}<br>
        Method: ${method}<br>
        Receipt no: ${esc(p.reference)}
      </div>
      <table class="rc-table">
        <thead><tr><th>ITEM</th><th>DUE DATE</th><th>AMOUNT</th></tr></thead>
        <tbody><tr>
          <td><strong>${esc(p.fee)}</strong></td>
          <td>${p.due_date ? esc(formatDate(p.due_date)) : '-'}</td>
          <td><strong>${esc(formatMoney(p.amount))}</strong></td>
        </tr></tbody>
      </table>
      <div class="rc-sum">
        <div><span>Subtotal</span><span>${esc(formatMoney(p.subtotal))} SGD</span></div>
        <div><span>GST (9%)</span><span>${esc(formatMoney(p.gst))} SGD</span></div>
        <div class="rc-total"><span>Total Paid</span><span>${esc(formatMoney(p.amount))}</span></div>
      </div>`;
  } catch (err) {
    showError('#receipt', err);
  }
})();