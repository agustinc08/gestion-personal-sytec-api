import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

const rejectedJwtSecrets = new Set(['change_me', 'changeme', 'secret', 'default-secret', 'password']);

export function validateEnvironment(config: Record<string, unknown>) {
  const secret = String(config.JWT_SECRET || '');
  const normalized = secret.toLowerCase();
  const placeholder = /^(replace|your|example|sample|default|change|changeme|secret|password)/.test(normalized);
  const lowDiversity = new Set(secret).size < 8;
  if (secret.length < 32 || rejectedJwtSecrets.has(normalized) || placeholder || lowDiversity) {
    throw new Error('JWT_SECRET must be configured with at least 32 non-default characters.');
  }
  return config;
}

@Injectable()
export class LoginRateLimitService {
  private readonly windowMs = 15 * 60 * 1000;
  private readonly maxAttempts = 10;
  private readonly attempts = new Map<string, { count: number; expiresAt: number }>();

  assertAllowed(ip: string, cuil: string, now = Date.now()) {
    this.prune(now);
    for (const key of this.keys(ip, cuil)) {
      if ((this.attempts.get(key)?.count || 0) >= this.maxAttempts) {
        throw new HttpException('Demasiados intentos. Esperá unos minutos y volvé a intentar.', HttpStatus.TOO_MANY_REQUESTS);
      }
    }
  }

  registerFailure(ip: string, cuil: string, now = Date.now()) {
    for (const key of this.keys(ip, cuil)) {
      const entry = this.attempts.get(key);
      this.attempts.set(key, {
        count: (entry && entry.expiresAt > now ? entry.count : 0) + 1,
        expiresAt: now + this.windowMs,
      });
    }
  }

  registerSuccess(ip: string, cuil: string) {
    for (const key of this.keys(ip, cuil)) this.attempts.delete(key);
  }

  private keys(ip: string, cuil: string) {
    return [`ip:${ip || 'unknown'}`, `cuil:${cuil}`];
  }

  private prune(now: number) {
    for (const [key, entry] of this.attempts) {
      if (entry.expiresAt <= now) this.attempts.delete(key);
    }
  }
}
