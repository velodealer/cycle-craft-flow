import PublicLayout from '@/components/public/PublicLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Release {
  period: string;
  title: string;
  items: string[];
}

const releases: Release[] = [
  {
    period: 'September 2026',
    title: 'Marketplaces, legal pages and the public site',
    items: [
      'eBay listing integration with per-bike item condition and category, plus direct links to your postage, payment and returns policies',
      'Shopify listing integration: bikes list when they are ready, drop to zero stock when sold, and Shopify orders mark them sold here',
      'Full terms of service, privacy policy and cookie policy, including the data processing agreement and sub-processor list',
      'Public website: features, pricing, about, blog, careers and contact',
    ],
  },
  {
    period: 'August 2026',
    title: 'Email, submissions and staff visibility',
    items: [
      'Email notifications for new bike submissions, repairs awaiting approval and logistics updates',
      'Branded password reset emails sent from your own domain',
      'Typeform integration: customer bike submissions land in an inbox with their photos copied into your storage',
      'Staff activity view showing what each person did, on which bikes, on any given day',
    ],
  },
  {
    period: 'July 2026',
    title: 'Inspections and repair approvals',
    items: [
      'InspectABike integration: create an inspection from the bike page and get the report link back',
      'Faults arrive with parts and labour prices and wait for your approval',
      'Repairs approval page grouping outstanding work by bike, with a costing popup',
      'Approvals push back to InspectABike, and completed repairs move the bike on automatically',
      'Undo an approval when something changes',
    ],
  },
  {
    period: 'June 2026',
    title: 'Sales, accounting and logistics',
    items: [
      'Record a sale with the real sale price, customer details, part exchange and delivery choice',
      'QuickBooks Online: stock on purchase, invoice, margin VAT and cost of sale on the sale',
      'Reverse a sale and the invoice and ledger entries unwind cleanly',
      'Cycle Courier Co bookings for both collections from sellers and deliveries to customers, with live tracking updates',
      'Collected and delivered statuses driven by the courier',
    ],
  },
  {
    period: 'May 2026',
    title: 'Specification, catalogue and identity',
    items: [
      '99Spokes lookup filling in the specification when you add a bike, or retrospectively',
      'Your own bike catalogue building itself from every lookup',
      'Component library growing automatically with each bike',
      'Meaningful bike references and printable 4x6 QR labels, singly or in batches',
      'Storage bays so you always know where a bike physically is',
    ],
  },
  {
    period: 'Earlier',
    title: 'The foundations',
    items: [
      'Bike intake, stage workflow, photos and condition notes',
      'Workshop and detailing jobs with checklists and photos',
      'Parts inventory, breaking bikes for parts and fitting parts to bikes',
      'Bike builder quotes with standard and margin VAT and saved versions',
      'Investor bikes with profit share and an investor-only view',
      'Reports: stock ageing, pipeline, margin, revenue and turnover',
      'Social media planner with scripts, calendar and scoring',
      'Roles and permissions across the whole system',
    ],
  },
];

interface RoadmapItem {
  title: string;
  description: string;
  stage: 'In progress' | 'Planned' | 'Exploring';
}

const roadmap: RoadmapItem[] = [
  {
    title: 'API documentation',
    description: 'A documented API so your website, till or reporting tools can talk to VeloDealer.',
    stage: 'In progress',
  },
  {
    title: 'Customer portal',
    description: 'A link customers can open to follow their repair or their sale without phoning you.',
    stage: 'Planned',
  },
  {
    title: 'Multi-site stock',
    description: 'Run more than one shop from one account, with stock and staff scoped per site.',
    stage: 'Planned',
  },
  {
    title: 'Purchase ordering and suppliers',
    description: 'Raise orders with your suppliers and book parts in against them.',
    stage: 'Planned',
  },
  {
    title: 'Service bookings and diary',
    description: 'Customers book a service slot and it lands in the workshop diary.',
    stage: 'Planned',
  },
  {
    title: 'Pricing guidance',
    description: 'Suggested asking prices based on what comparable bikes actually sold for.',
    stage: 'Exploring',
  },
  {
    title: 'More marketplaces',
    description: 'Facebook Marketplace and further channels alongside eBay and Shopify.',
    stage: 'Exploring',
  },
  {
    title: 'Mobile app for the workshop',
    description: 'Scan a label, add photos and update a job from your phone.',
    stage: 'Exploring',
  },
];

const stageVariant: Record<RoadmapItem['stage'], 'default' | 'secondary' | 'outline'> = {
  'In progress': 'default',
  Planned: 'secondary',
  Exploring: 'outline',
};

export default function UpdatesPage() {
  return (
    <PublicLayout
      title="Updates & Roadmap"
      description="What we have shipped in VeloDealer and what is coming next — integrations, workshop tools, accounting and marketplace listings."
    >
      <section className="border-b bg-muted/40">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Updates &amp; roadmap
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Everything we have built so far, and what we are working on next.
          </p>
        </div>
      </section>

      <section className="container mx-auto max-w-4xl px-4 py-16">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">What has shipped</h2>
        <ol className="mt-8 space-y-8 border-l pl-6">
          {releases.map((release) => (
            <li key={release.period} className="relative">
              <span className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full bg-primary" />
              <p className="text-sm font-medium text-primary">{release.period}</p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">{release.title}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {release.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        <h2 className="mt-16 text-2xl font-semibold tracking-tight text-foreground">What is next</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {roadmap.map((item) => (
            <Card key={item.title}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <Badge variant={stageVariant[item.stage]}>{item.stage}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          Missing something you need? Tell us on the contact page — customer requests decide what we
          build next.
        </p>
      </section>
    </PublicLayout>
  );
}
