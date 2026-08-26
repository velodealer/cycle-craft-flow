# Intake page cleanup

## Goal
Remove the "Start New Intake" entry point and the "Quick Stats" panel from the Intake page, leaving only the list of bikes awaiting intake and the per-bike "Process intake" workflow.

## What will change
- **src/pages/IntakePage.tsx**
  - Remove the `showForm` state and the full-page form branch (the per-bike dialog intake workflow stays).
  - Remove the `stats` state and the `today` / `week` / `pending` count queries from the `load()` function.
  - Remove the top two-column grid containing the **Start New Intake** card and **Quick Stats** card.
  - Clean up now-unused imports (`ClipboardCheck`, `ArrowLeft`, and any stat-related symbols if no longer used).
- Keep the **Bikes Awaiting Intake** list, selection checkboxes, **Print labels** button, and the **Process intake** dialog for individual bikes.

## Out of scope
- No changes to `IntakeForm.tsx` itself or the dashboard counts hook.
- No changes to navigation routes or quick-action buttons elsewhere unless the user asks.
