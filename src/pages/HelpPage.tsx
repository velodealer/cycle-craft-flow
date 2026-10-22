import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/velo/PageShell';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';

const GUIDES: { title: string; steps: string[] }[] = [
  { title: 'Taking in a bike', steps: ['Open Submissions or Intake and create the bike.', 'Use "Fill in bike details" to load the spec, then check each part.', 'Add intake photos and the purchase price, then move it to Cleaning.'] },
  { title: 'Cleaning and inspection', steps: ['Detailers tick the cleaning checklist; saving the full list closes it.', 'Mechanics record faults during inspection with photos and costs.', 'The bike waits in Repairs until an owner or admin decides every fault.'] },
  { title: 'Repairs and workshop jobs', steps: ['In Repairs, approve or reject each fault.', 'Every approved fault becomes a job in Jobs.', 'Jobs can be postponed with a reason; postponed jobs block handover, not listing.'] },
  { title: 'Listing a bike', steps: ['Add listing photos in order (these are the only photos sent to marketplaces).', 'Check the listing readiness list and fix anything flagged.', 'List on eBay, Shopify or Squarespace from the bike page, or export a CSV.'] },
  { title: 'Recording a sale', steps: ['On the bike page choose Record sale.', 'Pick the VAT scheme, add any part-exchange, and save.', 'The bike stays listed until you mark the deposit or payment as received.'] },
  { title: 'Parts and breaking bikes', steps: ['Fit stock parts from the bike spec; removed parts can go back to stock.', 'Break a bike to turn it into stock parts; each kept group becomes one stock item.', 'Sell a part from Parts with Record sale.'] },
  { title: 'Collections and deliveries', steps: ['Connect Cycle Courier in Settings → Integrations.', 'Book from the bike page; tracking updates appear automatically.', 'Handover marks the bike Collected or Delivered.'] },
  { title: 'Invoices and accounting', steps: ['Connect QuickBooks or Xero in Settings → Integrations.', 'Sales, part sales and stock purchases sync automatically.', 'Failed syncs show on the dashboard with a Retry button.'] },
  { title: 'Users and roles', steps: ['Admins add staff in Settings → User Management.', 'Mechanics and detailers never see money figures.', 'Only an admin or owner can change roles.'] },
  { title: 'Your data', steps: ['Admins can download all dealership data in Settings → Data & privacy.', 'You can also request that your dealership is deleted there.'] },
];

export default function HelpPage() {
  const [q, setQ] = useState('');
  const shown = GUIDES.filter((g) => !q || `${g.title} ${g.steps.join(' ')}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-6">
      <PageHeader title="Help" description="Short guides for each part of VeloDealer." />
      <Input placeholder="Search guides" value={q} onChange={(e) => setQ(e.target.value)} />
      <Accordion type="multiple" className="rounded-md border border-border bg-card">
        {shown.map((g) => (
          <AccordionItem key={g.title} value={g.title} className="px-4">
            <AccordionTrigger>{g.title}</AccordionTrigger>
            <AccordionContent>
              <ol className="list-decimal space-y-1 pl-5 text-sm">{g.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <p className="text-sm text-muted-foreground">
        Still stuck? <Link to="/contact" className="underline">Contact us</Link> · Service health: <Link to="/status" className="underline">status page</Link>
      </p>
    </div>
  );
}
