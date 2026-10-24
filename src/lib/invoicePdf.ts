import type { MirroredInvoice } from '@/components/invoice/InvoiceDocument';

const GREEN: [number, number, number] = [22, 78, 52];
const GREY: [number, number, number] = [110, 110, 110];

const fmtDate = (d: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

async function loadImage(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d')!.drawImage(bmp, 0, 0);
    return { data: c.toDataURL('image/png'), w: bmp.width, h: bmp.height };
  } catch { return null; }
}

/** Builds a real A4 PDF of the VeloDealer invoice and downloads it. */
export async function downloadGeneratedInvoicePdf(inv: MirroredInvoice) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const money = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: inv.currency || 'GBP' }).format(n);
  const W = 210, M = 16, R = W - M;
  const name = inv.seller?.name || inv.branding?.business_name || 'Invoice';
  const statusLabel = { paid: 'PAID', partial: 'PART PAID', unpaid: 'AWAITING PAYMENT', overdue: 'OVERDUE' }[inv.status];

  doc.setFillColor(...GREEN); doc.rect(0, 0, W, 4, 'F');
  let y = 16;

  const logo = inv.branding?.logo_url ? await loadImage(inv.branding.logo_url) : null;
  if (logo) {
    const h = 16, w = Math.min(60, (logo.w / logo.h) * h);
    doc.addImage(logo.data, 'PNG', M, y - 4, w, (w / ((logo.w / logo.h) * h)) * h);
    y += 16;
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(logo ? 11 : 16); doc.setTextColor(0);
  doc.text(name, M, y); y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GREY);
  [...(inv.seller?.address ?? []), inv.seller?.email, inv.seller?.phone].filter(Boolean).forEach((l) => { doc.text(String(l), M, y); y += 4; });

  doc.setFontSize(22); doc.setTextColor(...GREEN); doc.text('INVOICE', R, 18, { align: 'right' });
  doc.setFontSize(10); doc.setTextColor(0); doc.text(`No. ${inv.doc_number || '-'}`, R, 25, { align: 'right' });
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...(inv.status === 'overdue' ? [200, 30, 30] as [number, number, number] : GREEN));
  doc.text(statusLabel + (inv.status === 'paid' && inv.paid_at ? ` - ${fmtDate(inv.paid_at)}` : ''), R, 31, { align: 'right' });

  y = Math.max(y, 40) + 4;
  doc.setFillColor(245, 245, 245); doc.rect(M, y, R - M, 28, 'F');
  const label = (t: string, x: number, yy: number, align: 'left' | 'right' = 'left') => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...GREY); doc.text(t.toUpperCase(), x, yy, { align });
  };
  const val = (t: string, x: number, yy: number, size = 10, align: 'left' | 'right' = 'left') => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(0); doc.text(t, x, yy, { align });
  };
  label('Billed to', M + 4, y + 6); val(inv.customer_name || '-', M + 4, y + 11);
  inv.bill_address.slice(0, 3).forEach((l, i) => val(l, M + 4, y + 15 + i * 4, 8));
  label('Invoice date', 90, y + 6); val(fmtDate(inv.txn_date), 90, y + 11);
  label('Due date', 90, y + 17); val(fmtDate(inv.due_date), 90, y + 22);
  label('Balance due', R - 4, y + 6, 'right'); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(0);
  doc.text(money(inv.balance), R - 4, y + 14, { align: 'right' });
  y += 38;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GREY);
  doc.text('DESCRIPTION', M, y); doc.text('QTY', 150, y, { align: 'right' }); doc.text('AMOUNT', R, y, { align: 'right' });
  doc.setDrawColor(...GREEN); doc.setLineWidth(0.6); doc.line(M, y + 2, R, y + 2); y += 8;
  doc.setLineWidth(0.2); doc.setDrawColor(220);
  for (const l of inv.lines) {
    const lines = doc.splitTextToSize(l.description || '', 120) as string[];
    if (y + lines.length * 4.5 > 270) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0);
    doc.text(lines, M, y);
    doc.text(l.qty != null ? String(l.qty) : '', 150, y, { align: 'right' });
    doc.text(money(l.amount), R, y, { align: 'right' });
    y += lines.length * 4.5 + 2; doc.line(M, y - 3, R, y - 3); y += 2;
  }

  if (y > 220) { doc.addPage(); y = 20; }
  y += 4;
  const tx = 135; let ty = y;
  const row = (k: string, v: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(9); doc.setTextColor(0);
    doc.text(k, tx, ty); doc.text(v, R, ty, { align: 'right' }); ty += 6;
  };
  row('Subtotal', money(inv.subtotal));
  if (inv.tax > 0) row('VAT', money(inv.tax));
  row('Total', money(inv.total), true);
  if (inv.amount_paid > 0) row('Paid', `-${money(inv.amount_paid)}`);
  doc.setFillColor(...GREEN); doc.rect(tx - 2, ty - 4.5, R - tx + 2, 7, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.text('Balance due', tx, ty); doc.text(money(inv.balance), R - 1, ty, { align: 'right' });
  ty += 8;

  const bank = inv.branding?.bank;
  let by = y;
  if (bank) {
    doc.setDrawColor(...GREEN); doc.setLineWidth(0.3); doc.rect(M, by - 4, 100, 30);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0); doc.text('Please forward payment to', M + 3, by + 1);
    by += 7;
    const b = (k: string, v: string) => { doc.setFont('helvetica', 'normal'); doc.setTextColor(...GREY); doc.text(k, M + 3, by); doc.setTextColor(0); doc.setFont('courier', 'bold'); doc.text(v, M + 38, by); by += 5; };
    if (bank.account_name) b('Account holder', bank.account_name);
    b('Account number', bank.account_number);
    if (bank.sort_code) b('Sort code', bank.sort_code);
    if (inv.doc_number) b('Reference', inv.doc_number);
    by += 4;
  }
  y = Math.max(ty, by) + 6;

  if (inv.payments.length) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...GREY); doc.text('PAYMENTS RECEIVED', M, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0);
    inv.payments.forEach((p) => { doc.text(`${fmtDate(p.date)} - ${money(p.amount)}`, M, y); y += 5; });
  }
  const notes = [inv.customer_memo, inv.branding?.footer_note].filter(Boolean) as string[];
  if (notes.length) {
    y += 3; doc.setDrawColor(220); doc.line(M, y, R, y); y += 5;
    doc.setFontSize(8); doc.setTextColor(...GREY);
    notes.forEach((n) => { const t = doc.splitTextToSize(n, R - M) as string[]; doc.text(t, M, y); y += t.length * 4 + 2; });
  }
  doc.setFontSize(8); doc.setTextColor(...GREY); doc.text('Thank you for your business.', W / 2, 287, { align: 'center' });

  doc.save(`Invoice-${(inv.doc_number || 'invoice').replace(/[^A-Za-z0-9.-]/g, '')}.pdf`);
}
