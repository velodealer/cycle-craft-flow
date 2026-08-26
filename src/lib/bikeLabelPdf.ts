import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { bikeRef } from './bikeReference';

export interface PdfLabelBike {
  id: string;
  reference?: string | null;
  make: string;
  model: string;
  size?: string | null;
  colour?: string | null;
  frame_number?: string | null;
}

const W = 4; // inches
const H = 6; // inches
const PAD = 0.3;

function fit(doc: jsPDF, text: string, maxWidth: number, startSize: number): number {
  let size = startSize;
  while (size > 7 && doc.getStringUnitWidth(text) * (size / 72) > maxWidth) {
    size -= 1;
    doc.setFontSize(size);
  }
  return size;
}

function drawField(doc: jsPDF, label: string, value: string, x: number, y: number, valueSize: number, maxWidth: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(110);
  doc.text(label, x, y);

  doc.setTextColor(0);
  doc.setFontSize(valueSize);
  const size = fit(doc, value, maxWidth, valueSize);
  doc.text(value, x, y + size / 72 + 0.03);
  return y + size / 72 + 0.12;
}

/** Generates a PDF with one exact 4in x 6in page per bike and triggers a download. */
export async function downloadBikeLabelsPdf(bikes: PdfLabelBike[], origin: string) {
  const doc = new jsPDF({ unit: 'in', format: [W, H], orientation: 'portrait' });
  const inner = W - PAD * 2;

  for (let i = 0; i < bikes.length; i++) {
    if (i > 0) doc.addPage([W, H], 'portrait');
    const bike = bikes[i];

    let y = PAD + 0.1;
    y = drawField(doc, 'BRAND', bike.make || '—', PAD, y, 22, inner);
    y = drawField(doc, 'MODEL', bike.model || '—', PAD, y + 0.08, 17, inner);

    const rowY = y + 0.08;
    drawField(doc, 'SIZE', bike.size || '—', PAD, rowY, 14, inner / 2 - 0.1);
    y = drawField(doc, 'COLOUR', bike.colour || '—', PAD + inner / 2, rowY, 14, inner / 2 - 0.1);

    drawField(doc, 'SERIAL NUMBER', bike.frame_number || '—', PAD, y + 0.08, 14, inner);

    // QR block anchored to the bottom
    const qrSize = 1.7;
    const qrY = H - PAD - qrSize - 0.55;
    doc.setDrawColor(0);
    doc.setLineWidth(0.02);
    doc.line(PAD, qrY - 0.18, W - PAD, qrY - 0.18);

    const dataUrl = await QRCode.toDataURL(`${origin}/bikes/${bike.id}`, {
      margin: 0,
      width: 512,
      errorCorrectionLevel: 'M',
    });
    doc.addImage(dataUrl, 'PNG', (W - qrSize) / 2, qrY, qrSize, qrSize);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(110);
    doc.text('BIKE ID', W / 2, qrY + qrSize + 0.14, { align: 'center' });

    doc.setTextColor(0);
    doc.setFont('courier', 'bold');
    doc.setFontSize(12);
    doc.text(bikeRef(bike), W / 2, qrY + qrSize + 0.33, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(110);
    doc.text('Scan to view bike details', W / 2, qrY + qrSize + 0.49, { align: 'center' });
  }

  const name = bikes.length === 1 ? `label-${bikeRef(bikes[0])}.pdf` : `bike-labels-${bikes.length}.pdf`;
  doc.save(name);
}
