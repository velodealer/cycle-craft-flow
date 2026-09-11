# Keep fault status in step with InspectABike

Make sure an approval here shows as approved over on InspectABike, and that when the mechanic marks the fault repaired there, it comes back and shows as repaired here — with the bike moving on by itself once nothing is outstanding.

## What you will see

1. Approving a fault sends the decision to InspectABike and only marks it approved here once InspectABike confirms. If it fails, the fault stays as it was and you get a clear message.
2. When the fault is marked repaired on InspectABike, it flips to **Repaired** here automatically, and the linked labour job on the bike is marked complete.
3. Declining works the same way and is mirrored over there.
4. A later update from InspectABike can no longer quietly knock an approved or declined fault back to "Awaiting approval".
5. Once every fault is repaired or declined, the bike leaves Awaiting Approval and goes to Ready for Sale on its own.
6. The Refresh button pulls the same statuses in, for anything the webhook missed.

## Technical detail

**Fault status precedence (shared helper)**
- `normaliseFault` gains an optional `event` argument. `fault.repaired` forces `status: 'repaired'` regardless of payload; `fault.created`/`fault.updated` use the payload status when it is one of the five known values.
- Add `mergeFaultStatus(localStatus, incomingStatus)`: never downgrade `approved`/`declined`/`awaiting_part`/`repaired` back to `reported`; a remote `repaired` always wins. Upserts read the existing row first (by `external_fault_id`) and apply this rule, so remote pricing/text updates still land while local decisions survive.

**`inspectabike-webhook`**
- Pass the event through to `normaliseFault`; apply `mergeFaultStatus`.
- On a resulting `repaired` status, set `repaired_at` (new nullable timestamp column on `inspection_faults`) and, when `job_id` is set, update that job to `status: 'completed'` with `completed_at`.
- Stop hardcoding `has_issues: true`; recompute it as "any fault row exists for this inspection".
- Keep returning 200 fast for unknown events.

**`inspectabike-decision`**
- Treat a non-2xx from `/partner-fault-decision` as a hard failure (already thrown) and additionally adopt the status InspectABike returns in the response body when it supplies one, so the two sides cannot diverge.

**`inspectabike-sync`**
- Use the same merge rule when upserting so a manual refresh cannot reset local decisions, and apply the same repaired→job-completion side effect.

**UI**
- `InspectionFaults.tsx`: show a "Repaired" state distinctly (success styling) and surface `repaired_at` where present. No change to approve/decline controls.

**Database**
- One migration: add `repaired_at timestamptz` to `inspection_faults`.
