// GRADING RESULTS - CONTROLLER: reads the request, calls the model, sends the answer.
const gradingModel = require('../models/gradingModel');

async function listGradings(req, res) {
  res.json(await gradingModel.listGradings());
}

module.exports = { listGradings };
