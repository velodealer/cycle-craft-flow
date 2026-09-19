import { Link } from 'react-router-dom';
import PublicLayout from '@/components/public/PublicLayout';
import { Button } from '@/components/ui/button';

const values = [
  {
    title: 'Built in a workshop, not a boardroom',
    body: 'Every screen exists because someone stood at a bench and needed it. If a feature does not save time on the shop floor, it does not ship.',
  },
  {
    title: 'One bike, one record',
    body: 'A bike arrives once and carries everything with it — photos, inspection, parts, labour, costs, listings, invoice and courier. No spreadsheets on the side.',
  },
  {
    title: 'Honest numbers',
    body: 'Cost and margin are calculated the same way for everyone: the team, the accountant and the investor all see the same figure.',
  },
  {
    title: 'Integrations that finish the job',
    body: 'Accounting, couriers, inspections and marketplaces are part of the workflow, not an export you have to reconcile later.',
  },
];

export default function AboutPage() {
  return (
    <PublicLayout
      title="About"
      description="VeloDealer is a bicycle dealer management system built by VDMS Ltd for shops that buy, refurbish and sell bikes."
    >
      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-16">
          <h1 className="font-display text-[40px] font-bold leading-tight text-foreground md:text-[56px]">About VeloDealer</h1>
          <p className="mt-4 max-w-[65ch] text-lg text-muted-foreground">
            Software for shops that buy, refurbish and sell bicycles — and want to know exactly what
            each one earned.
          </p>
        </div>
      </section>

      <section className="container mx-auto max-w-3xl px-4 py-12">
        <h2 className="font-display text-xl font-semibold text-foreground">Why we built it</h2>
        <p className="prose-board mt-3 text-muted-foreground">
          Second-hand bicycle trading is a margin business run on memory. A bike comes in, someone
          cleans it, someone else fixes it, parts get taken off another bike, photos get taken on a
          phone, it goes up on a marketplace, it sells, and at the end of the month nobody can say
          what it actually made. The stock list lives in a spreadsheet, the workshop lives on a
          whiteboard and the accounts get pieced together afterwards.
        </p>
        <p className="prose-board mt-3 text-muted-foreground">
          VeloDealer replaces all of that with one record per bike. The intake, the photos, the
          inspection report, every part and hour, the storage bay, the listings, the invoice and the
          courier booking all hang off the same bike. Costs add up as they happen, so the margin is
          right the moment you record the sale — and the accounts are already posted.
        </p>

        <h2 className="mt-12 font-display text-xl font-semibold text-foreground">What we believe</h2>
        {values.map((value) => (
          <div key={value.title} className="mt-4">
            <h3 className="font-display font-semibold text-foreground">{value.title}</h3>
            <p className="prose-board mt-1 text-muted-foreground">{value.body}</p>
          </div>
        ))}

        <h2 className="mt-12 font-display text-xl font-semibold text-foreground">The company</h2>
        <div className="mt-4 rounded-[4px] border border-border bg-card">
          {[
            ['Legal entity', 'VDMS Ltd'],
            ['Registered address', '30 Wake Green Road, Birmingham, B13 9PB'],
            ['Contact', 'info@velodealer.com'],
            ['Product', 'VeloDealer dealer management system'],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
              <span className="label-text text-muted-foreground">{label}</span>
              <span className="text-sm text-foreground">{value}</span>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/contact">Get in touch</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/careers">See open roles</Link>
          </Button>
        </div>
      </section>
    </PublicLayout>
  );
}
