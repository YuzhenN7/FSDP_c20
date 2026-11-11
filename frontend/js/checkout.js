// Simulated payment gateway page (follows the Figma "payment gateway" frame).
// Used by frontend/student/checkout.html
(function () {
  const session = new URLSearchParams(location.search).get('session');
  const box = document.getElementById('checkout');
  const money = (n) => formatMoney(Number(n));

  async function show() {
    try {
      const a = await api.get(`/student/checkout/${session}`);
      if (a.status === 'paid') return done('This payment is already complete.');
      if (a.status === 'failed') return failed(a.failure_reason);

      box.className = 'co-card';
      box.innerHTML = `
        <div class="co-left">
          <a class="co-back" href="/student/fees.html">Back to my fees</a>
          <div class="co-label">Paying for</div>
          <div class="co-fee">${esc(a.fee)}</div>
          <div class="co-label">Amount due</div>
          <div class="co-total">${esc(money(a.amount))}</div>
          <div class="co-student"><span>Student</span><span>${esc(a.student_name)}</span></div>
        </div>
        <div class="co-right">
          <div class="co-paywith">Pay With</div>
          <div class="co-rows">
            <div class="kv"><span>CARD</span><span>Visa ***1234</span></div>
            <div class="kv"><span>CONTACT</span><span>${esc(a.student_email)}</span></div>
            <div class="kv"><span>SUBTOTAL</span><span>${esc(money(a.subtotal))}</span></div>
            <div class="kv"><span>GST</span><span>${esc(money(a.gst))}</span></div>
            <div class="kv"><span>TOTAL</span><span>${esc(money(a.amount))}</span></div>
          </div>
          <p class="error" id="err"></p>
          <button class="btn co-pay" id="payBtn" type="button">Pay ${esc(money(a.amount))}</button>
          <button class="linkbtn co-test" id="failBtn" type="button">Simulate declined card (testing only)</button>
        </div>`;
      document.getElementById('payBtn').onclick = () => send('success');
      document.getElementById('failBtn').onclick = () => send('fail');
    } catch (err) {
      box.className = 'card';
      box.innerHTML = `<p class="error">${esc(err.message)}</p><a href="/student/fees.html">Back to my fees</a>`;
    }
  }

  async function send(outcome) {
    document.querySelectorAll('#checkout button').forEach((b) => { b.disabled = true; });   // stop double clicks
    try {
      const r = await api.post(`/student/checkout/${session}/result`, { outcome });
      if (r.status === 'paid') location.href = `/student/payment-success.html?id=${r.payment_id}`;
      else failed(r.failure_reason);
    } catch (err) {
      document.getElementById('err').textContent = err.message;
      document.querySelectorAll('#checkout button').forEach((b) => { b.disabled = false; });
    }
  }

  function done(msg) {
    box.className = 'card';
    box.innerHTML = `<p>${esc(msg)}</p><a class="btn" href="/student/fees.html">Back to my fees</a>`;
  }

  function failed(reason) {
    box.className = 'card';
    box.innerHTML = `
      <h2>Payment failed</h2>
      <p class="error">${esc(reason || 'Payment declined')}</p>
      <p class="muted">You have not been charged and the fee is still unpaid.</p>
      <a class="btn" href="/student/fees.html">Back to my fees to try again</a>`;
  }

  show();
})();