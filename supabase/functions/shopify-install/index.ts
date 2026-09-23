// Shopify app install entry point.
// Shopify sends the merchant here (the app's App URL) with ?shop=&hmac=&timestamp=
// We verify the signature and redirect straight to the OAuth grant screen.
import {
  serviceClient,
  normaliseShopDomain,
  redirectUri,
  hmacHex,
  timingSafeEqual,
  SHOPIFY_SCOPES,
} from '../_shared/shopify.ts';

const APP_ORIGIN = Deno.env.get('SHOPIFY_APP_ORIGIN') || 'https://velodealer.com';

const fail = (message: string, status = 400) =>
  new Response(message, { status, headers: { 'Content-Type': 'text/plain' } });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const shopParam = url.searchParams.get('shop');

  // No shop parameter: nothing Shopify-specific to do, send to the app.
  if (!shopParam) {
    return new Response(null, { status: 302, headers: { Location: APP_ORIGIN } });
  }

  try {
    const clientId = Deno.env.get('SHOPIFY_CLIENT_ID');
    const clientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
    if (!clientId || !clientSecret) throw new Error('Shopify app credentials are not configured');

    const params = new URLSearchParams(url.search);
    const providedHmac = params.get('hmac') || '';
    if (!providedHmac) throw new Error('Missing signature');
    params.delete('hmac');
    params.delete('signature');
    const sorted = [...params.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    const expected = await hmacHex(clientSecret, sorted);
    if (!timingSafeEqual(expected, providedHmac)) throw new Error('Signature check failed');

    const shop = normaliseShopDomain(shopParam);
    const nonce = `install|${crypto.randomUUID()}`;
    const { error: stErr } = await serviceClient().from('shopify_oauth_states').insert({ state: nonce, shop });
    if (stErr) throw new Error('Could not start a secure install session');
    const state = nonce;
    const authUrl = `https://${shop}/admin/oauth/authorize?` + new URLSearchParams({
      client_id: clientId,
      scope: SHOPIFY_SCOPES,
      redirect_uri: redirectUri(),
      state,
    });
    return new Response(null, { status: 302, headers: { Location: authUrl } });
  } catch (e) {
    console.error('shopify-install error:', (e as Error).message);
    return fail(`Could not start the Shopify installation: ${(e as Error).message}`, 400);
  }
});
