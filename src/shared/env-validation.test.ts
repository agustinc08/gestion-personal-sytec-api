import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateEnvironment, LoginRateLimitService } from './env-validation';

describe('environment validation', () => {
  it('requires a non-default JWT secret with at least 32 characters', () => {
    assert.throws(() => validateEnvironment({ JWT_SECRET: 'change_me' }));
    assert.throws(() => validateEnvironment({ JWT_SECRET: 'short-secret' }));
    assert.throws(() => validateEnvironment({ JWT_SECRET: 'a'.repeat(64) }));
    assert.throws(() => validateEnvironment({ JWT_SECRET: `replace_this_${'x'.repeat(40)}` }));
    const validSecret = 'AbC_19!secure-JWT$Key+for-test-value';
    assert.equal(validateEnvironment({ JWT_SECRET: validSecret }).JWT_SECRET, validSecret);
  });
});

describe('login rate limiting', () => {
  it('limits by both client address and normalized CUIL and expires the window', () => {
    const limiter = new LoginRateLimitService();
    for (let attempt = 0; attempt < 10; attempt += 1) limiter.registerFailure('10.0.0.1', '20123456789', 1000);
    assert.throws(() => limiter.assertAllowed('10.0.0.1', '20123456789', 1001));
    assert.throws(() => limiter.assertAllowed('10.0.0.1', '20999999999', 1001));
    assert.doesNotThrow(() => limiter.assertAllowed('10.0.0.1', '20123456789', 901001));
  });
});
