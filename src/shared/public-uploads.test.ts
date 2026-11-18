import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { configurePublicUploads } from './public-uploads';

describe('public upload mounts', () => {
  it('mounts only explicit public folders and excludes private license certificates', () => {
    const mounts: Array<{ path: string; prefix: string }> = [];
    configurePublicUploads({ useStaticAssets: (path, options) => { mounts.push({ path, prefix: options.prefix }); } }, '/app/uploads');
    assert.deepEqual(mounts.map((mount) => mount.prefix), ['/uploads/avatars/', '/uploads/license-templates/']);
    assert.ok(mounts.every((mount) => !mount.path.endsWith('/licenses')));
  });
});
