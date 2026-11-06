// ATTENDANCE (admin) - CONTROLLER: reads the request, calls the model, sends the answer.
const attendanceModel = require('../models/attendanceModel');

async function listAttendance(req, res) {
  res.json(await attendanceModel.listAttendance());
}

module.exports = { listAttendance };
