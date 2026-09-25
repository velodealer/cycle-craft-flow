# Break bike: better part grouping

## What changes
On the Break bike screen:

1. **The frame always includes the fork, headset and bottom bracket.** Those three no longer show as separate rows. The Frame row lists them, e.g. "Includes: Frame, Fork, Headset, Bottom Bracket".
2. **New tick box: "Include seatpost & saddle with frame".** When it's ticked, those two move into the Frame row. This works the same way as the existing groupset tick box.
3. **New tick box: "Group tyres with wheels".** When it's ticked, a single "Wheels — [wheelset]" row replaces the wheelset, front tyre, rear tyre and any tube or rim tape rows.
4. **The groupset now includes the disc rotors** as well as the crank, cassette, chain, derailleurs, shifters and brakes.

When you break the bike, each group becomes one stock item with the value you enter, as the groupset does now. The parts inside a group are recorded against that item.

## Technical details
- File: `src/components/bike/BreakBikeDialog.tsx`.
- Add `FRAME_SLOTS = ['frame','fork','headset','bottom_bracket']` (always absorbed) and `FRAME_OPTIONAL_SLOTS = ['seatpost','saddle']` (behind a new `groupSeatSaddle` toggle).
- Add `WHEEL_SLOTS = ['wheelset','front_wheel','rear_wheel']` and `TYRE_SLOTS = ['front_tyre','rear_tyre','tubes','rim_tape']`, behind a `groupWheels` toggle. The group row appears only when a wheel slot exists.
- Add `disc_rotors` (plus the `rotors` alias if it's in `SPEC_SECTIONS`) to `DRIVETRAIN_SLOTS`.
- The frame group's `componentIds` and `slotLabels` now come from the absorbed slots. The description is built from the slot labels.
- Initialise `group:wheels` in keep state. Update the break/save handler so the frame and wheels groups are handled the same way as the existing drivetrain group (one inventory part, with the component IDs linked).
- Confirm the exact slot keys against `SPEC_SECTIONS` before coding.
