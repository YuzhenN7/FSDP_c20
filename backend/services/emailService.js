// Receipt email. Right now it only PRINTS the email to the terminal (simulated).
// Later, swap the console.log for a real email service (e.g. Resend, SendGrid or Nodemailer).
// The layout follows the "5 · Receipt email" screen in Figma.

function money(amount) {
  return '$' + Number(amount).toFixed(2);
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Builds the receipt as HTML.  payment = { fee, amount, paid_at, method, reference }
function renderReceiptHtml(studentName, payment) {
  const date = new Date(payment.paid_at).toLocaleDateString('en-SG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  return `
<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;border:1px solid #e3e1d8;border-radius:8px;overflow:hidden">
  <div style="background:#1f3a5f;color:#fff;padding:16px 20px;font-weight:bold">Aikido Shinjukai</div>
  <div style="padding:20px">
    <h2 style="margin:0 0 8px">Payment received</h2>
    <p>Hi ${escapeHtml(studentName)}, thanks for your payment. This is your receipt.</p>
    <table style="width:100%;font-size:14px">
      <tr><td>Fee</td><td align="right"><b>${escapeHtml(payment.fee)}</b></td></tr>
      <tr><td>Date paid</td><td align="right"><b>${escapeHtml(date)}</b></td></tr>
      <tr><td>Method</td><td align="right"><b>${escapeHtml(payment.method)}</b></td></tr>
      <tr><td>Reference</td><td align="right"><b>${escapeHtml(payment.reference)}</b></td></tr>
      <tr><td><b>Amount paid</b></td><td align="right"><b>${money(payment.amount)}</b></td></tr>
    </table>
    <p style="font-size:12px;color:#666">Keep this email as proof of payment. If something looks wrong, contact your dojo admin.</p>
  </div>
</div>`;
}

async function sendReceiptEmail(toEmail, studentName, payment) {
  const subject = `Receipt for your payment: ${payment.fee}`;
  const html = renderReceiptHtml(studentName, payment);
  // TODO: replace with a real email provider
  console.log(`[simulated email] To: ${toEmail} | Subject: ${subject}`);
  return { toEmail, subject, html };
}

module.exports = { sendReceiptEmail, renderReceiptHtml };
