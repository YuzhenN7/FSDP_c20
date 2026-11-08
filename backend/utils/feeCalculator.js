const GST_RATE = 9; 
const r2 = (n) => Math.round(n * 100) / 100;

function priceBreakdown(base, discountPercent = 0) {
  const discount = r2(base * discountPercent / 100);
  const gst = r2((base - discount) * GST_RATE / 100);
  return { base: r2(base), discount, gst, final: r2(base - discount + gst) };
}

module.exports = { GST_RATE, priceBreakdown };

