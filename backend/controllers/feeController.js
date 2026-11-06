// FEES (admin) - CONTROLLER: reads the request, calls the model, sends the answer.
const feeModel = require('../models/feeModel');

async function listFees(req, res) {
  res.json(await feeModel.listFees());
}

module.exports = { listFees };
