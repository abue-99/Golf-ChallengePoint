import {
  assertAuthSecretsConfigured,
  getAccessSecret,
  getRefreshSecret,
} from './secrets';

describe('auth secrets', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it('throws when ACCESS_SECRET is missing (no fallback)', () => {
    delete process.env.ACCESS_SECRET;
    expect(() => getAccessSecret()).toThrow(/ACCESS_SECRET/);
  });

  it('throws when REFRESH_SECRET is too short', () => {
    process.env.REFRESH_SECRET = 'short';
    expect(() => getRefreshSecret()).toThrow(/REFRESH_SECRET/);
  });

  it('rejects identical access and refresh secrets', () => {
    process.env.ACCESS_SECRET = 'a'.repeat(40);
    process.env.REFRESH_SECRET = 'a'.repeat(40);
    expect(() => assertAuthSecretsConfigured()).toThrow(/different/);
  });

  it('returns configured secrets', () => {
    process.env.ACCESS_SECRET = 'a'.repeat(40);
    process.env.REFRESH_SECRET = 'b'.repeat(40);
    expect(() => assertAuthSecretsConfigured()).not.toThrow();
    expect(getAccessSecret()).toBe('a'.repeat(40));
  });
});
