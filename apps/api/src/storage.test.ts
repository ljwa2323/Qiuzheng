import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { resolveLocalObjectPath } from './lib/s3.js';

test('local object storage keeps keys inside its configured root', () => {
  const root = resolve('.runtime-test');
  assert.equal(resolveLocalObjectPath(root, 'imports/file.ris'), resolve(root, 'imports/file.ris'));
  assert.throws(() => resolveLocalObjectPath(root, '../outside.txt'), /Invalid local object key/);
  assert.throws(() => resolveLocalObjectPath(root, 'C:\\outside.txt'), /Invalid local object key/);
});
