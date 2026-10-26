import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  randomBytes,
  sign,
} from 'crypto';

/**
 * Minimal Web Push sender without extra dependencies:
 * VAPID (RFC 8292) and "aes128gcm" payload encryption (RFC 8291 / RFC 8188).
 */

export type VapidKeys = {
  /** base64url, 65-byte uncompressed P-256 point */
  publicKey: string;
  /** base64url, 32-byte private scalar */
  privateKey: string;
  /** "mailto:…" or an https URL */
  subject: string;
};

export type PushTarget = {
  endpoint: string;
  /** base64url client public key */
  p256dh: string;
  /** base64url auth secret (16 bytes) */
  auth: string;
};

export function b64url(buffer: Buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function fromB64url(value: string) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/** New VAPID key pair (base64url). */
export function generateVapidKeys() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    publicKey: b64url(ecdh.getPublicKey()),
    privateKey: b64url(ecdh.getPrivateKey()),
  };
}

function hmac(key: Buffer, data: Buffer) {
  return createHmac('sha256', key).update(data).digest();
}

/** HKDF (RFC 5869) with a single expand block (≤ 32 bytes). */
function hkdf(salt: Buffer, ikm: Buffer, info: Buffer, length: number) {
  const prk = hmac(salt, ikm);
  return hmac(prk, Buffer.concat([info, Buffer.from([1])])).subarray(0, length);
}

/** Encrypts `payload` for one subscription (aes128gcm content coding). */
export function encryptPayload(
  payload: Buffer,
  target: { p256dh: string; auth: string },
  options: { salt?: Buffer; serverKeys?: ReturnType<typeof createECDH> } = {},
) {
  const uaPublic = fromB64url(target.p256dh);
  const authSecret = fromB64url(target.auth);
  if (uaPublic.length !== 65 || authSecret.length < 16) {
    throw new Error('Invalid subscription keys');
  }
  const server = options.serverKeys ?? createECDH('prime256v1');
  if (!options.serverKeys) server.generateKeys();
  const asPublic = server.getPublicKey();
  const ecdhSecret = server.computeSecret(uaPublic);

  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'utf8'),
    uaPublic,
    asPublic,
  ]);
  const ikm = hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const salt = options.salt ?? randomBytes(16);
  const cek = hkdf(
    salt,
    ikm,
    Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'),
    16,
  );
  const nonce = hkdf(
    salt,
    ikm,
    Buffer.from('Content-Encoding: nonce\0', 'utf8'),
    12,
  );

  // Single record: payload + 0x02 delimiter (last record), no padding.
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.concat([payload, Buffer.from([2])])),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096);
  const header = Buffer.concat([
    salt,
    recordSize,
    Buffer.from([asPublic.length]),
    asPublic,
  ]);
  return Buffer.concat([header, encrypted]);
}

/** "vapid t=<jwt>, k=<public key>" for the push service of `endpoint`. */
export function vapidAuthorization(
  endpoint: string,
  keys: VapidKeys,
  now = Date.now(),
) {
  const audience = new URL(endpoint).origin;
  const header = b64url(
    Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })),
  );
  const claims = b64url(
    Buffer.from(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(now / 1000) + 12 * 60 * 60,
        sub: keys.subject,
      }),
    ),
  );
  const publicKey = fromB64url(keys.publicKey);
  const key = createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      d: keys.privateKey,
      x: b64url(publicKey.subarray(1, 33)),
      y: b64url(publicKey.subarray(33, 65)),
    },
    format: 'jwk',
  });
  const signature = sign('sha256', Buffer.from(`${header}.${claims}`), {
    key,
    dsaEncoding: 'ieee-p1363',
  });
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${keys.publicKey}`;
}

/** Sends one push message. Returns the HTTP status of the push service. */
export async function sendWebPush(
  target: PushTarget,
  payload: unknown,
  keys: VapidKeys,
  options: {
    ttl?: number;
    urgency?: 'low' | 'normal' | 'high';
    topic?: string;
  } = {},
) {
  const body = encryptPayload(
    Buffer.from(JSON.stringify(payload), 'utf8'),
    target,
  );
  const headers: Record<string, string> = {
    Authorization: vapidAuthorization(target.endpoint, keys),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(options.ttl ?? 24 * 60 * 60),
    Urgency: options.urgency ?? 'normal',
  };
  if (options.topic)
    headers.Topic = options.topic.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
  const res = await fetch(target.endpoint, { method: 'POST', headers, body });
  return res.status;
}
