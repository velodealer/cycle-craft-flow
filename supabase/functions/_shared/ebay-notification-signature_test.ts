import { assert, assertEquals, assertRejects, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { generateKeyPairSync, sign } from 'node:crypto';
import { normalizeEbayPublicKey, verifyEbayBody } from './ebay-notification-signature.ts';

const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pem = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const raw = pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, '');

Deno.test('normalizes the raw Base64 EC key returned by eBay', () => {
  assertEquals(normalizeEbayPublicKey(raw), pem.trim());
});

Deno.test('preserves and normalizes an existing PEM public key', () => {
  assertEquals(normalizeEbayPublicKey(pem), pem.trim());
});

Deno.test('rejects empty and malformed public keys', () => {
  assertThrows(() => normalizeEbayPublicKey(''));
  assertThrows(() => normalizeEbayPublicKey('not a key!'));
  assertThrows(() => normalizeEbayPublicKey('YWJjZA=='));
});

Deno.test('verifies a valid eBay-style ECDSA SHA-1 signature over the raw body', () => {
  const body = '{"notification":{"data":{"userId":"123"}}}';
  const signature = sign('sha1', new TextEncoder().encode(body), keys.privateKey).toString('base64');
  assert(verifyEbayBody(body, signature, normalizeEbayPublicKey(raw)));
  assertEquals(verifyEbayBody(`${body}\n`, signature, normalizeEbayPublicKey(raw)), false);
});