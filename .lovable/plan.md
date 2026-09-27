# List bikes with small jobs deferred

## The idea
Split the jobs on a bike into two kinds:
- **Must do before listing**: safety or anything a buyer would see in photos or on a test ride (brakes, steering, frame damage, and so on).
- **Can be deferred**: small jobs that don't affect the listing, such as a bar-tape swap, cable trim, a minor adjustment or a top-up service.

An owner or admin can mark a job as **Deferred – do before handover**. Once every job that isn't deferred is done, the bike can move to Ready for Sale and be listed. Deferred jobs aren't forgotten. They stay on the bike, and the workshop must finish them before the bike is collected or shipped.

## The process
```text
Inspection -> Repairs approval -> Jobs
                                   |
      owner/admin defers small jobs (reason required)
                                   |
   all non-deferred jobs done -> Ready for Sale -> Listed
                                   |
                     Sold -> deferred jobs become urgent
                                   |
  deferred jobs done -> handover / courier booking allowed
```

## Rules
1. **Who:** only owner or admin can defer a job, and they must give a reason. The system records who deferred it and when, and adds it to the bike's history.
2. **What can't be deferred:** jobs in safety categories (brakes, steering/headset, frame/fork, wheels/tyres structural). The Defer button isn't shown for these. The owner can change this list in Settings.
3. **Advancing to Ready:** the Advance stage dialog lists any deferred jobs and needs a tick to confirm "Listing with N deferred jobs". If a job is still open and not deferred, the bike can't move to Ready.
4. **Listing:** eBay, Shopify and the CSV exports work as normal. There's an optional per-dealer setting to add a line to the description such as "Final workshop check completed before dispatch". Nothing is added by default.
5. **On sale:** deferred jobs move to the top of the Jobs page with a "Sold – before handover" badge. Booking a Cycle Courier delivery or marking the bike collected/delivered is blocked until they're done. An owner can override this with a reason.
6. **Visibility:**
   - The bike card shows a "2 deferred jobs" badge.
   - The Jobs page gets a "Deferred" section, so mechanics can pick jobs up when they have spare time.
   - The dashboard gets a "Deferred jobs" count and a "Sold, awaiting deferred work" count.
7. **Costs:** deferred jobs keep their parts and labour costs, so profit figures stay accurate before the work is done.
8. **Undo:** an owner can un-defer a job. If the bike is Ready or Listed and that job is still open, they're warned.

## Technical details
- Add columns to `jobs`: `deferred boolean default false`, `deferred_reason text`, `deferred_by uuid`, `deferred_at timestamptz`. Only owner/admin can change these (update policy or trigger check).
- Add a `deferrable` flag on the categories used for faults and jobs (slot/fault category), seeded false for safety categories.
- Ready gate in the Advance stage dialog and the admin status picker: block when open jobs exist where `deferred = false` and the job isn't a detailing job.
- Handover gate in Cycle Courier delivery booking and the collected/delivered status change: block when open deferred jobs exist on a sold bike, unless an owner override is logged in bike activity.
- Jobs page, bike cards and dashboard counts read the new flag. The bike stays at status `ready`/`listed`, so no new bike status is needed.
- Record the rule in AGENTS.md: "Deferred jobs never block listing but always block handover."
