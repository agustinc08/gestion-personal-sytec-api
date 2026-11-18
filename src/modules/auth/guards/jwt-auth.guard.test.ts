import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('required password change guard', () => {
  const temporaryUser = { id: 'user-a', mustChangePassword: true };
  const context = { getHandler: () => ({}), getClass: () => ({}) } as any;

  it('blocks authenticated sessions with a temporary password', () => {
    const guard = new JwtAuthGuard({ getAllAndOverride: () => false } as unknown as Reflector);
    assert.throws(() => guard.handleRequest(null, temporaryUser, null, context), ForbiddenException);
  });

  it('allows explicitly whitelisted password-change endpoints', () => {
    const guard = new JwtAuthGuard({ getAllAndOverride: () => true } as unknown as Reflector);
    assert.equal(guard.handleRequest(null, temporaryUser, null, context), temporaryUser);
  });
});
