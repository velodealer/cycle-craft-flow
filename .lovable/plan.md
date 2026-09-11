# Move bikes to Repair once every fault is decided

Right now a bike sits in "Awaiting approval" until InspectABike reports the work as repaired, even after every fault has been approved or declined. It should step through Repair first.

## What you will see

- While any fault is still undecided, the bike stays in **Awaiting approval**.
- As soon as every fault has been approved or declined, the bike moves to **Repair** automatically.
- If nothing was approved (everything declined) and the inspection is finished, the bike goes straight to **Ready for sale**.
- When InspectABike marks the approved work repaired — fault by fault, or via the one-off "all faults completed" message — the bike moves to **Ready for sale** by itself.
- This applies whether the decision was made on the bike page, on the Repairs page, or came in from InspectABike.

## Technical detail

Single change point: `syncBikeStatusFromFaults` in `supabase/functions/_shared/inspectabike.ts`, which the webhook, decision and sync functions all call.

New status rule, given the bike is currently in `inspection` / `pending_approval` / `repair` / `ready`:

```text
any fault status = reported            -> pending_approval
else any status in (approved, awaiting_part) -> repair
else (all repaired/declined, or no faults)   -> ready, if inspection completed
```

- Keep `isOpenFault` as-is for the webhook's existing "any open fault" check, and add a `needsDecision` (status `reported`) helper for the pending_approval test.
- The bike is only promoted to `ready` when the inspection is completed, as today; the `repair` transition does not require that.
- No database or UI changes; the existing progress bar already renders the `repair` status.
