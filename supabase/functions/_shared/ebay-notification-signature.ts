import { createPublicKey, createVerify } from 'node:crypto';

const BEGIN_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----';
const END_PUBLIC_KEY = '-----END PUBLIC KEY-----';

export function normalizeEbayPublicKey(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('eBay returned an empty public key');
  }

  const body = value
    .replace(BEGIN_PUBLIC_KEY, '')
    .replace(END_PUBLIC_KEY, '')
    .replace(/\s+/g, '');

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body) || body.length % 4 !== 0) {
    throw new Error('eBay returned a malformed public key');
  }

  const lines = body.match(/.{1,64}/g);
  if (!lines) throw new Error('eBay returned an empty public key');
  const pem = `${BEGIN_PUBLIC_KEY}\n${lines.join('\n')}\n${END_PUBLIC_KEY}`;

  // Parse it now so failures are treated as a key-lookup problem, not as a bad notification.
  createPublicKey(pem);
  return pem;
}

export function verifyEbayBody(rawBody: string, signature: string, publicKeyPem: string): boolean {
  const verifier = createVerify('sha1');
  verifier.update(rawBody);
  verifier.end();
  return verifier.verify(publicKeyPem, signature, 'base64');
}