import test from 'node:test';
import assert from 'node:assert/strict';
import { canManageProject, canWriteProject, roleAtLeast } from './index.js';

test('project role helpers', () => {
  assert.equal(canWriteProject('viewer'), false);
  assert.equal(canWriteProject('reviewer'), true);
  assert.equal(canManageProject('lead'), true);
  assert.equal(roleAtLeast('owner', 'lead'), true);
  assert.equal(roleAtLeast('reviewer', 'lead'), false);
});
