const { queryAll } = require('../config/db');

function findByIdentity(normalizedName, phoneHash) {
  return queryAll(
    `SELECT student_id, name, phone_last_four, course, branch, year, section
     FROM students WHERE normalized_name = ? AND phone_lookup_hash = ?`,
    [normalizedName, phoneHash]
  );
}

module.exports = { findByIdentity };
