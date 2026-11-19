import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '@prisma/client';
import { FALLBACK_PAGE_SIZE, MAX_PAGE_SIZE, getConfiguredPageSize, getPageOptions, paginate } from './pagination';

describe('pagination contract', () => {
  it('returns separate pages with consistent totals', async () => {
    const rows = Array.from({ length: 5 }, (_, index) => index + 1);
    const pageOne = await paginate({ page: '1', pageSize: '2' }, 25, async ({ skip, take }) => rows.slice(skip, skip + take), async () => rows.length);
    const pageTwo = await paginate({ page: '2', pageSize: '2' }, 25, async ({ skip, take }) => rows.slice(skip, skip + take), async () => rows.length);
    assert.deepEqual(pageOne.items, [1, 2]);
    assert.deepEqual(pageTwo.items, [3, 4]);
    assert.equal(pageOne.total, 5);
    assert.equal(pageOne.totalPages, 3);
  });

  it('normalizes invalid pages and clamps page size to the maximum', () => {
    assert.deepEqual(getPageOptions({ page: '-2', pageSize: '10000000' }), { page: 1, pageSize: MAX_PAGE_SIZE, skip: 0, take: MAX_PAGE_SIZE });
    assert.equal(getPageOptions({ page: 'abc', pageSize: '0' }).page, 1);
    assert.equal(getPageOptions({}, FALLBACK_PAGE_SIZE).pageSize, FALLBACK_PAGE_SIZE);
  });

  it('uses numeric pagination values for string query params and clamps pageSize above 100', () => {
    assert.deepEqual(getPageOptions({ page: '2', pageSize: '25' }), { page: 2, pageSize: 25, skip: 25, take: 25 });
    assert.deepEqual(getPageOptions({ page: '1', pageSize: '100' }), { page: 1, pageSize: 100, skip: 0, take: 100 });
    assert.deepEqual(getPageOptions({ page: 'abc', pageSize: '999999' }), { page: 1, pageSize: 100, skip: 0, take: 100 });
  });

  it('falls back to the default page size only when the optional setting table or column is unavailable', async () => {
    for (const code of ['P2021', 'P2022']) {
      const prisma = {
        systemSetting: {
          findUnique: async () => {
            throw new Prisma.PrismaClientKnownRequestError('missing optional setting schema', { code, clientVersion: 'test' });
          },
        },
      };
      assert.equal(await getConfiguredPageSize(prisma), FALLBACK_PAGE_SIZE);
    }
    await assert.rejects(
      getConfiguredPageSize({ systemSetting: { findUnique: async () => { throw new Error('database unavailable'); } } }),
      /database unavailable/,
    );
  });

  it('applies filtering before the page slice and counts only filtered records', async () => {
    const records = [{ name: 'Ana', active: true }, { name: 'Ana María', active: true }, { name: 'Bruno', active: true }];
    const filtered = records.filter((record) => record.active && record.name.toLowerCase().includes('ana'));
    const result = await paginate({ q: 'ana', page: '2', pageSize: '1' }, 25, async ({ skip, take }) => filtered.slice(skip, skip + take), async () => filtered.length);
    assert.deepEqual(result.items, [{ name: 'Ana María', active: true }]);
    assert.equal(result.total, 2);
    assert.equal(result.totalPages, 2);
  });
});
