// CLASSES and SCHEDULING (also venues and instructors) - CONTROLLER: reads the request, calls the model, sends the answer.
const classModel = require('../models/classModel');

async function listClasses(req, res) {
  res.json(await classModel.listClasses());
}

async function listVenues(req, res) {
  res.json(await classModel.listVenues());
}

async function listInstructors(req, res) {
  res.json(await classModel.listInstructors());
}

module.exports = { listClasses, listVenues, listInstructors };
