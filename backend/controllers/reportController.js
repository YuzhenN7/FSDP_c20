// REPORTS and DASHBOARD numbers - CONTROLLER: reads the request, calls the model, sends the answer.
const reportModel = require('../models/reportModel');

async function getSummary(req, res) {
  res.json(await reportModel.getSummary());
}

module.exports = { getSummary };
