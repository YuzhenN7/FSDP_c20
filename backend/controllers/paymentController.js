// PAYMENTS (admin view / payment tracking) - CONTROLLER: reads the request, calls the model, sends the answer.
const paymentModel = require('../models/paymentModel');

async function listPayments(req, res) {
  res.json(await paymentModel.listPayments());
}

module.exports = { listPayments };
