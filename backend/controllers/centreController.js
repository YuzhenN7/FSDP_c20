// CENTRES - CONTROLLER: reads the request, calls the model, sends the answer.
const centreModel = require('../models/centreModel');

async function listCentres(req, res) {
  res.json(await centreModel.listCentres());
}

module.exports = { listCentres };
