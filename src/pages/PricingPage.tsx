import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import PublicLayout from '@/components/public/PublicLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const plans = [
  {
    name: 'Starter',
    description: 'For small workshops getting organised.',
    features: ['TBC — users', 'TBC — bikes in stock', 'TBC — integrations included', 'TBC — support level'],
  },
  {
    name: 'Pro',
    description: 'For established dealers running full operations.',
    features: ['TBC — users', 'TBC — bikes in stock', 'TBC — integrations included', 'TBC — support level'],
  },
  {
    name: 'Business',
    description: 'For multi-site dealers and teams.',
    features: ['TBC — users', 'TBC — bikes in stock', 'TBC — integrations included', 'TBC — support level'],
  },
];

const faqs = [
  {
    q: 'Are prices inclusive of VAT?',
    a: 'All prices are stated exclusive of VAT, which will be added where applicable.',
  },
  {
    q: 'How does billing work?',
    a: 'Subscriptions are billed monthly or annually in advance and renew automatically at the end of each billing period unless cancelled before the renewal date.',
  },
  {
    q: 'Can I cancel at any time?',
    a: 'Yes. You can cancel your subscription at any time with effect from the end of the current billing period, and access continues until that period ends.',
  },
  {
    q: 'Can prices change?',
    a: 'We may change subscription fees by giving at least 30 days’ notice. Changes take effect from your next renewal, and you may cancel before a change takes effect if you do not accept it.',
  },
];

export default function PricingPage() {
  return (
    <PublicLayout
      title="Pricing"
      description="VeloDealer subscription plans and pricing. Simple monthly or annual plans for bicycle dealers — billed per dealership, VAT excluded."
    >
      <div className="container mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Pricing</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          VeloDealer is available on a subscription, billed monthly or annually in advance. Choose the plan that fits
          your dealership — you can change plan at any time.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.name} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <div className="mb-4">
                  <span className="text-4xl font-bold tracking-tight text-foreground">TBC</span>
                  <span className="ml-2 text-sm text-muted-foreground">per month, excl. VAT</span>
                </div>
                <ul className="space-y-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link to="/auth">Choose plan</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <Separator className="my-10" />

        <section>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Frequently asked questions</h2>
          <div className="mt-4 space-y-5 text-sm">
            {faqs.map((faq) => (
              <div key={faq.q}>
                <h3 className="font-semibold text-foreground">{faq.q}</h3>
                <p className="mt-1 text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        <Separator className="my-10" />

        <nav className="flex flex-wrap gap-4 text-sm">
          <Link to="/pricing" className="text-foreground">
            Pricing
          </Link>
          <Link to="/terms" className="text-muted-foreground transition-colors hover:text-foreground">
            End-User Licence Agreement
          </Link>
          <Link to="/privacy" className="text-muted-foreground transition-colors hover:text-foreground">
            Privacy Policy
          </Link>
          <Link to="/cookies" className="text-muted-foreground transition-colors hover:text-foreground">
            Cookie Policy
          </Link>
        </nav>

        <p className="mt-8 text-sm text-muted-foreground">
          VDMS Ltd, 30 Wake Green Road, Birmingham, B13 9PB. Email: info@velodealer.com.
        </p>
      </div>
    </PublicLayout>
  );
}
