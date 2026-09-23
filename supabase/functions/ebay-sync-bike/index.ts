// Lists, updates, ends or removes a single bike on the connected eBay account.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { serviceClient, requireUser, requireRole, businessIdForUser, businessIdForBike } from '../_shared/ebay.ts';
import {
  pushBikeToEbay,
  prepareListing,
  endEbayListing,
  deleteEbayListing,
  recordListingError,
  conditionLabel,
} from '../_shared/ebay-listing.ts';
import { logBikeActivity } from '../_shared/activity.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const STAFF = ['admin', 'owner', 'mechanic', 'detailer', 'accountant', 'social_manager', 'customer_service'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = serviceClient();

  let callerBusinessId: string;
  try {
    const user = await requireUser(req, supabase);
    await requireRole(supabase, user.id, STAFF);
    callerBusinessId = await businessIdForUser(supabase, user.id);
  } catch (e) {
    return json({ error: (e as Error).message }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const bikeId = String(body.bike_id ?? '');
  const action = String(body.action ?? 'list');
  if (!bikeId) return json({ error: 'bike_id is required' }, 400);

  try {
    if ((await businessIdForBike(supabase, bikeId)) !== callerBusinessId) {
      return json({ error: 'Bike not found' }, 404);
    }

    if (action === 'end') {
      const ended = await endEbayListing(supabase, bikeId);
      if (ended) {
        await logBikeActivity(bikeId, {
          kind: 'listing',
          action: 'ended',
          summary: 'eBay listing ended',
          actorLabel: 'eBay',
        }, callerBusinessId);
      }
      return json({ ok: true, ended });
    }

    if (action === 'remove') {
      const removed = await deleteEbayListing(supabase, bikeId);
      if (removed) {
        await logBikeActivity(bikeId, {
          kind: 'listing',
          action: 'removed',
          summary: 'eBay listing removed',
          actorLabel: 'eBay',
        }, callerBusinessId);
      }
      return json({ ok: true, removed });
    }

    const { data: bike, error } = await supabase
      .from('bikes')
      .select('*')
      .eq('id', bikeId)
      .maybeSingle();
    if (error || !bike) return json({ error: 'Bike not found' }, 404);

    if (action === 'preview') {
      const p = await prepareListing(supabase, bike as any);
      return json({
        title: p.title,
        built_title: p.builtTitle,
        title_format: p.titleFormat,
        category_id: p.categoryId,
        category_source: p.categorySource,
        condition: p.condition,
        wanted_condition: p.wantedCondition,
        aspects: p.aspectResult.aspects,
        specifics: {
          filled: p.aspectResult.recommendedFilled,
          total: p.aspectResult.recommendedTotal,
          missing_required: p.aspectResult.missingRequired,
          missing_recommended: p.aspectResult.missingRecommended,
          unmapped: p.aspectResult.unmapped,
        },
        photos: p.images.map((u) => ({ url: u, longest: p.photoSizes[u] ?? null })),
        mobile_preview: p.mobilePreview,
        best_offer: { enabled: p.bestOffer.enabled },
        promotion: p.promotion,
        checklist: p.checklist,
        can_publish: !p.checklist.some((c) => c.level === 'block'),
      });
    }

    const result = await pushBikeToEbay(supabase, bike as any);
    await logBikeActivity(bikeId, {
      kind: 'listing',
      action: 'listed',
      summary: 'Listed on eBay',
      detail: { offer_id: result.offerId, listing_id: result.listingId, url: result.url },
      actorLabel: 'eBay',
    }, callerBusinessId);
    if (result.substitution) {
      await logBikeActivity(bikeId, {
        kind: 'listing',
        action: 'condition_substituted',
        summary: `eBay condition changed from ${conditionLabel(result.substitution.from)} to ${conditionLabel(result.substitution.to)}`,
        detail: { from: result.substitution.from, to: result.substitution.to },
        actorLabel: 'eBay',
      }, callerBusinessId);
    }
    return json({
      ok: true,
      offer_id: result.offerId,
      listing_id: result.listingId,
      url: result.url,
      warnings: result.warnings,
    });
  } catch (e) {
    const message = (e as Error).message;
    console.error('ebay-sync-bike failed:', message);
    if (action === 'preview') return json({ error: message }, 400);
    await recordListingError(supabase, bikeId, message);
    await logBikeActivity(bikeId, {
      kind: 'listing',
      action: 'failed',
      summary: 'eBay listing failed',
      detail: { note: message },
      actorLabel: 'eBay',
    }, callerBusinessId);
    return json({ error: message }, 400);
  }
});
