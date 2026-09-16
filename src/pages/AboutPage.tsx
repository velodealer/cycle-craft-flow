import { Link } from 'react-router-dom';
import PublicLayout from '@/components/public/PublicLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
      <section className="border-b bg-muted/40">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">About VeloDealer</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Software for shops that buy, refurbish and sell bicycles — and want to know exactly what
            each one earned.
          </p>
        </div>
      </section>

      <section className="container mx-auto max-w-3xl px-4 py-16 text-sm leading-relaxed">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Why we built it</h2>
        <p className="mt-3 text-muted-foreground">
          Second-hand bicycle trading is a margin business run on memory. A bike comes in, someone
          cleans it, someone else fixes it, parts get taken off another bike, photos get taken on a
          phone, it goes up on a marketplace, it sells, and at the end of the month nobody can say
          what it actually made. The stock list lives in a spreadsheet, the workshop lives on a
          whiteboard and the accounts get pieced together afterwards.
        </p>
        <p className="mt-3 text-muted-foreground">
          VeloDealer replaces all of that with one record per bike. The intake, the photos, the
          inspection report, every part and hour, the storage bay, the listings, the invoice and the
          courier booking all hang off the same bike. Costs add up as they happen, so the margin is
          right the moment you record the sale — and the accounts are already posted.
        </p>

        <h2 className="mt-12 text-2xl font-semibold tracking-tight text-foreground">What we believe</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {values.map((value) => (
            <Card key={value.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{value.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{value.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <h2 className="mt-12 text-2xl font-semibold tracking-tight text-foreground">The company</h2>
        <p className="mt-3 text-muted-foreground">
          VeloDealer is built and operated by VDMS Ltd, 30 Wake Green Road, Birmingham, B13 9PB.
          You can reach us at info@velodealer.com.
        </p>

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
