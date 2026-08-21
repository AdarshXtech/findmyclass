const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeBranch, normalizeSection, parseCsaiSection } = require('../utils/validation');

test('CSAI class aliases normalize to branch, year, and section', () => {
  for (const alias of ['2B', 'csai 2b', 'CSAI-2B', 'CSEAI2B', 'CSE AI 2B']) {
    assert.equal(normalizeSection(alias), 'CSAI2B');
  }
  assert.equal(normalizeSection('2F'), 'CSAI2F');
  assert.equal(normalizeBranch('CSE AI'), 'CSAI');
  assert.deepEqual(parseCsaiSection('CSAI2F'), {
    branch: 'CSAI', year: 2, section: 'CSAI2F', sectionLetter: 'F',
  });
  assert.equal(normalizeSection('CSE-A'), 'CSE-A');
});
