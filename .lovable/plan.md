# Guarantee true 4" x 6" labels

Short answer: not guaranteed today. The current label uses `window.print()` with `@page { size: 4in 6in }` and a 4in x 6in div. That is correct on desktop Chrome, but two things break it:

1. Nothing hides the rest of the app when printing. Only the label toolbar has `print:hidden`; the whole page behind the overlay (dashboard, nav, other lists) is still in the DOM and prints, so output can contain extra pages and unexpected scaling.
2. Mobile browsers (the current view is a 360px phone) largely ignore `@page size`. Chrome on Android renders "Save as PDF" at the printer's default paper (A4/Letter) and shrinks the label to fit, so the downloaded PDF is not 4x6.

## What to change

**1. Isolate the print output**
Render the label overlay so that during print only the label is visible: hide the app root's other children via a print stylesheet (`body > #root > *:not(.label-print-root) { display: none }` approach or a `print-hidden` class toggled while the overlay is open), and remove the overlay's own scroll container from print flow.

**2. Fix exact page geometry**
- Label box: exactly `4in x 6in`, `box-sizing: border-box`, `overflow: hidden`, no outer margins.
- `@page { size: 4in 6in; margin: 0 }` plus `html, body { width: 4in; margin: 0 }` inside print media.
- Page break only *between* labels (current logic is right, keep it) so N bikes = N pages, no trailing blank page.

**3. Add a "Download 4x6 PDF" button (the reliable path, especially on mobile)**
Generate the PDF ourselves instead of trusting the browser's print dialog:
- Use `jspdf` with `new jsPDF({ unit: 'in', format: [4, 6] })` — page size is then exactly 4x6 regardless of device.
- Render each label into the PDF: draw text with jsPDF text APIs and place the QR code as a PNG data URL (render the QR to a canvas from the same `qrcode.react` value, or use the `qrcode` package's `toDataURL`).
- One `addPage()` per bike, then `doc.save('bike-labels.pdf')`.
- Keep the existing Print button for desktop/label-printer users; the PDF button becomes the default suggestion on small screens.

**4. Verify**
After building, download a sample PDF and check the reported MediaBox is 288 x 432 pt (= 4in x 6in) before reporting done.

## Technical notes
- Files touched: `src/components/bike/BikeLabels.tsx` (print isolation, geometry, new button), plus a new `src/lib/bikeLabelPdf.ts` for the jsPDF generation so both single and bulk printing share it. `BikeLabel.tsx` and `PrintLabelsButton.tsx` need no logic change.
- New dependency: `jspdf` (and `qrcode` if we generate the QR data URL outside React).
- Label content stays identical: brand, model, size, colour, serial (frame number), QR, and bike reference under the QR.
