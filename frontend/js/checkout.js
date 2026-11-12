// Simulated payment gateway page (follows the Figma "payment gateway" frame).
// Used by frontend/student/checkout.html
(function () {
  const session = new URLSearchParams(location.search).get('session');
  const box = document.getElementById('checkout');
  const money = (n) => formatMoney(Number(n));
  let attempt = null;

  async function show() {
    try {
      const a = await api.get(`/student/checkout/${session}`);
      attempt = a;
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
          <button class="linkbtn co-test" id="cancelBtn" type="button">Cancel payment</button>
        </div>`;
        // <button class="linkbtn co-test" id="failBtn" type="button">Simulate declined card (testing only)</button>
      document.getElementById('payBtn').onclick = () => send('success');
      document.getElementById('cancelBtn').onclick = () => send('cancel');
      //document.getElementById('failBtn').onclick = () => send('fail');
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

  async function retry() {
    document.querySelectorAll('#checkout button').forEach((b) => { b.disabled = true; });
    try {
      const r = await api.post(`/student/fees/${attempt.fee_id}/pay`);
      location.href = r.checkout_url;
    } catch (err) {
      document.getElementById('retryErr').textContent = err.message;
      document.querySelectorAll('#checkout button').forEach((b) => { b.disabled = false; });
    }
  }

  function done(msg) {
    box.className = 'card';
    box.innerHTML = `<p>${esc(msg)}</p><a class="btn" href="/student/fees.html">Back to my fees</a>`;
  }

  function failed(reason) {
    const cancelled = reason === 'Payment cancelled';
    box.className = 'co-fail';
    box.innerHTML = `
      <div class="fail-icon">&times;</div>
      <h1 class="fail-title">${cancelled ? 'Payment Cancelled' : 'Payment Failure'}</h1>
      <p class="fail-sub">${cancelled ? "You cancelled the payment and you haven't been charged." : "Your payment didn't go through and you haven't been charged."}<br>Your fee is still unpaid.</p>
      <div class="fail-table">
        <div class="kv"><span>Fee</span><strong>${esc(attempt.fee)}</strong></div>
        <div class="kv"><span>Amount</span><strong>${esc(money(attempt.amount))}</strong></div>
        <div class="kv"><span>Reason</span><strong>${esc(reason || 'Payment Declined')}</strong></div>
        <div class="kv"><span>Status</span><span class="badge failed">Failed</span></div>
      </div>
      <p class="error" id="retryErr"></p>
      <div class="fail-actions">
        <button class="btn" id="retryBtn" type="button">Try again</button>
        <a class="btn outline" href="/student/payment-history.html">View Payment History</a>
        <a class="btn outline" href="/student/fees.html">Back to My fees</a>
      </div>`;
    document.getElementById('retryBtn').onclick = retry;
  }

  show();
})();