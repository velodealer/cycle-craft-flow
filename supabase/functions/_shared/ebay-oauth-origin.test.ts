import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { allowedOrigin, classifyCallback, isInvalidGrant, DEFAULT_APP_ORIGIN } from './ebay-oauth-origin.ts';

Deno.test('allowedOrigin accepts own domains only', () => {
  assertEquals(allowedOrigin('https://velodealer.com/x'), 'https://velodealer.com');
  assertEquals(allowedOrigin('https://app.velodealer.com'), 'https://app.velodealer.com');
  assertEquals(allowedOrigin('https://id-preview--abc.lovable.app'), 'https://id-preview--abc.lovable.app');
  assertEquals(allowedOrigin('https://evil.com'), DEFAULT_APP_ORIGIN);
  assertEquals(allowedOrigin('https://velodealer.com.evil.com'), DEFAULT_APP_ORIGIN);
  assertEquals(allowedOrigin('http://velodealer.com'), DEFAULT_APP_ORIGIN);
  assertEquals(allowedOrigin('javascript:alert(1)'), DEFAULT_APP_ORIGIN);
  assertEquals(allowedOrigin(undefined), DEFAULT_APP_ORIGIN);
});

Deno.test('classifyCallback', () => {
  const c = (q: string) => classifyCallback(new URLSearchParams(q));
  assertEquals(c('code=x&state=y'), 'code');
  assertEquals(c('declined=1'), 'declined');
  assertEquals(c('declined=1&state=y'), 'declined');
  assertEquals(c('error=access_denied'), 'declined');
  assertEquals(c('error=server_error'), 'error');
  assertEquals(c('state=y'), 'declined');
  assertEquals(c(''), 'none');
});

Deno.test('isInvalidGrant', () => {
  assertEquals(isInvalidGrant(400, '{"error":"invalid_grant"}'), true);
  assertEquals(isInvalidGrant(500, 'invalid_grant'), false);
  assertEquals(isInvalidGrant(400, 'invalid_scope'), false);
});
