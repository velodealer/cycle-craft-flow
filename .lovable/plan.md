# Keep fault status in step with InspectABike

Make sure an approval here shows as approved over on InspectABike, and that when the mechanic marks the fault repaired there, it comes back and shows as repaired here — with the bike moving on by itself once nothing is outstanding.

## What you will see

1. Approving a fault sends the decision to InspectABike and only marks it approved here once InspectABike confirms. If it fails, the fault stays as it was and you get a clear message. (Per InspectABike's docs, we only send approved/declined and an optional note — never prices — and who decided and when is recorded.)
2. When the fault is marked repaired on InspectABike, it flips to **Repaired** here automatically, and the linked labour job on the bike is marked complete.
3. Declining works the same way and is mirrored over there.
4. A later update from InspectABike can no longer quietly knock an approved or declined fault back to "Awaiting approval".
5. When InspectABike sends its one-time **inspection.faults_completed** event (all faults repaired or declined), the bike is released from Awaiting Approval to Ready for Sale automatically, using the totals and full fault list in that webhook.
6. The Refresh button pulls the same statuses in, for anything the webhook missed.

## Technical detail

**Fault status precedence (shared helper)**
- `normaliseFault` gains an optional `event` argument. `fault.repaired` forces `status: 'repaired'` regardless of payload; `fault.created`/`fault.updated` use the payload status when it is one of the five known values.
- Add `mergeFaultStatus(localStatus, incomingStatus)`: never downgrade `approved`/`declined`/`awaiting_part`/`repaired` back to `reported`; a remote `repaired` always wins. Upserts read the existing row first (by `external_fault_id`) and apply this rule, so remote pricing/text updates still land while local decisions survive.

**`inspectabike-webhook`**
- Pass the event through to `normaliseFault`; apply `mergeFaultStatus`.
- On a resulting `repaired` status, set `repaired_at` (new nullable timestamp column on `inspection_faults`) and, when `job_id` is set, update that job to `status: 'completed'` with `completed_at`.
- Handle `inspection.faults_completed`: upsert the full fault list it carries, set `repaired_at` on repaired rows, mark the inspection completed (`status: 'completed'`, `completed_at`, plus grade/inspector if present), then force the bike to `ready` when it is currently in `pending_approval` (or `repair`/`inspection` with no open faults). Store the event's totals on the inspection `raw`/notes is not needed — the fault rows already carry the numbers; just acknowledge 200. It fires once, but handle it idempotently.
- Stop hardcoding `has_issues: true`; recompute it as "any fault row exists for this inspection".

**`inspectabike-decision`**
- Keep sending `{ fault_id, decision, note?, actor_name }` with no costs. A non-2xx is a hard failure (already thrown) and nothing local changes; additionally adopt the status InspectABike returns in the response body when it supplies one, so the two sides cannot diverge.

**`inspectabike-sync`**
- Use the same merge rule when upserting so a manual refresh cannot reset local decisions, and apply the same repaired→job-completion side effect.

**UI**
- `InspectionFaults.tsx`: show the Repaired state with `repaired_at` where present. No change to approve/decline controls.

**Database**
- One migration: add `repaired_at timestamptz` to `inspection_faults`.
