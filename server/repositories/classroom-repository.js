const { queryAll } = require('../config/db');

function findBySection(section) {
  return queryAll(
    `SELECT classroom_id, section, subject, floor, wing, room
     FROM classrooms WHERE section = ? ORDER BY subject`,
    [section]
  );
}

module.exports = { findBySection };
