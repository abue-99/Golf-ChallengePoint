import {
  createDecipheriv,
  createECDH,
  createHmac,
  createPublicKey,
  verify,
} from 'crypto';
import {
  b64url,
  encryptPayload,
  fromB64url,
  generateVapidKeys,
  vapidAuthorization,
} from './web-push';

function hmac(key: Buffer, data: Buffer) {
  return createHmac('sha256', key).update(data).digest();
}
function hkdf(salt: Buffer, ikm: Buffer, info: Buffer, length: number) {
  return hmac(
    hmac(salt, ikm),
    Buffer.concat([info, Buffer.from([1])]),
  ).subarray(0, length);
}

/** Decrypts like a browser would (RFC 8291 receiver side). */
function decrypt(
  body: Buffer,
  ua: ReturnType<typeof createECDH>,
  auth: Buffer,
) {
  const salt = body.subarray(0, 16);
  const idLength = body[20];
  const asPublic = body.subarray(21, 21 + idLength);
  const ciphertext = body.subarray(21 + idLength);
  const secret = ua.computeSecret(asPublic);
  const info = Buffer.concat([
    Buffer.from('WebPush: info\0'),
    ua.getPublicKey(),
    asPublic,
  ]);
  const ikm = hkdf(auth, secret, info, 32);
  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
  const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
  const plain = Buffer.concat([
    decipher.update(ciphertext.subarray(0, ciphertext.length - 16)),
    decipher.final(),
  ]);
  expect(plain[plain.length - 1]).toBe(2);
  return plain.subarray(0, plain.length - 1).toString('utf8');
}

describe('web push', () => {
  it('encrypts a payload the subscriber can decrypt', () => {
    const ua = createECDH('prime256v1');
    ua.generateKeys();
    const auth = Buffer.from('0123456789abcdef');
    const body = encryptPayload(Buffer.from('{"title":"Hi ⛳"}'), {
      p256dh: b64url(ua.getPublicKey()),
      auth: b64url(auth),
    });
    expect(body.readUInt32BE(16)).toBe(4096);
    expect(decrypt(body, ua, auth)).toBe('{"title":"Hi ⛳"}');
  });

  it('matches the RFC 8291 test vector', () => {
    const server = createECDH('prime256v1');
    server.setPrivateKey(
      fromB64url('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'),
    );
    const body = encryptPayload(
      Buffer.from('When I grow up, I want to be a watermelon'),
      {
        p256dh:
          'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
        auth: 'BTBZMqHH6r4Tts7J_aSIgg',
      },
      { salt: fromB64url('DGv6ra1nlYgDCS1FRnbzlw'), serverKeys: server },
    );
    expect(b64url(body)).toBe(
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
    );
  });

  it('rejects broken subscription keys', () => {
    expect(() =>
      encryptPayload(Buffer.from('x'), { p256dh: 'abc', auth: 'def' }),
    ).toThrow();
  });

  it('signs a VAPID token that verifies with the public key', () => {
    const keys = { ...generateVapidKeys(), subject: 'mailto:test@example.com' };
    const header = vapidAuthorization(
      'https://web.push.apple.com/abc/def',
      keys,
      1_000_000,
    );
    const match = /^vapid t=([^,]+), k=(.+)$/.exec(header);
    expect(match).not.toBeNull();
    const [h, c, s] = match![1].split('.');
    const claims = JSON.parse(fromB64url(c).toString('utf8')) as Record<
      string,
      unknown
    >;
    expect(claims).toEqual({
      aud: 'https://web.push.apple.com',
      exp: 1000 + 43200,
      sub: 'mailto:test@example.com',
    });
    expect(match![2]).toBe(keys.publicKey);
    const pub = fromB64url(keys.publicKey);
    const key = createPublicKey({
      key: {
        kty: 'EC',
        crv: 'P-256',
        x: b64url(pub.subarray(1, 33)),
        y: b64url(pub.subarray(33)),
      },
      format: 'jwk',
    });
    expect(
      verify(
        'sha256',
        Buffer.from(`${h}.${c}`),
        { key, dsaEncoding: 'ieee-p1363' },
        fromB64url(s),
      ),
    ).toBe(true);
  });
});
