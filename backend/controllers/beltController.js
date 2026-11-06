// BELT LEVELS - CONTROLLER: reads the request, calls the model, sends the answer.
const beltModel = require('../models/beltModel');

async function listBelts(req, res) {
  res.json(await beltModel.listBelts());
}

module.exports = { listBelts };
