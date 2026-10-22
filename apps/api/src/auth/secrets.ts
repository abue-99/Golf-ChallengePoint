/**
 * Central access to JWT secrets.
 *
 * There are intentionally NO fallback values: a missing secret would allow
 * anyone who knows the fallback to forge tokens (including SYSADMIN tokens).
 * The API refuses to start (see main.ts) and token operations throw if a
 * secret is missing or too short.
 */
const MIN_SECRET_LENGTH = 32;

function readSecret(name: 'ACCESS_SECRET' | 'REFRESH_SECRET'): string {
  const value = process.env[name];
  if (!value || value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${name} must be set to a random string of at least ${MIN_SECRET_LENGTH} characters.`,
    );
  }
  return value;
}

export function getAccessSecret(): string {
  return readSecret('ACCESS_SECRET');
}

export function getRefreshSecret(): string {
  return readSecret('REFRESH_SECRET');
}

/** Throws on startup if any required secret is missing. */
export function assertAuthSecretsConfigured(): void {
  getAccessSecret();
  getRefreshSecret();
  if (process.env.ACCESS_SECRET === process.env.REFRESH_SECRET) {
    throw new Error('ACCESS_SECRET and REFRESH_SECRET must be different.');
  }
}
