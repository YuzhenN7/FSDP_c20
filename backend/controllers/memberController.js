// MEMBERS = STUDENTS (admin view) - CONTROLLER: reads the request, calls the model, sends the answer.
const memberModel = require('../models/memberModel');

async function listMembers(req, res) {
  res.json(await memberModel.listMembers());
}

module.exports = { listMembers };
