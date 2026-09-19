import { Link } from 'react-router-dom';
import PublicLayout from '@/components/public/PublicLayout';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface FeatureGroup {
  title: string;
  summary: string;
  points: string[];
}

const groups: FeatureGroup[] = [
  {
    title: 'Bike intake',
    summary: 'Get a bike onto the system in minutes, with everything recorded from the start.',
    points: [
      'Guided intake capturing make, model, year, size, colour, frame and serial numbers',
      'Photos taken at intake and kept with the bike for its whole life',
      'Automatic bike reference (your prefix, brand and serial) printed on a 4x6 label with a QR code',
      'Specification lookup from the 99Spokes catalogue fills in the spec, groupset and wheels for you',
      'Your own catalogue builds itself from every bike you look up',
      'Record how the bike arrived: bought, taken on consignment, funded by an investor or part exchanged',
    ],
  },
  {
    title: 'Workshop and repairs',
    summary: 'Every job, part and hour attached to the bike it belongs to.',
    points: [
      'Workshop and detailing jobs with checklists, before and after photos and assigned mechanics',
      'Stage progression from intake to cleaning, inspection, repair and ready for sale',
      'Repairs approval screen listing every bike with outstanding work and its cost',
      'Approve, decline or undo a decision, with the cost flowing straight into the bike',
      'Notes and photos captured at each stage stay on the bike history',
    ],
  },
  {
    title: 'Inspections',
    summary: 'Independent condition reports from InspectABike, wired straight into your workflow.',
    points: [
      'Create an inspection from the bike page with one click',
      'Faults arrive automatically with parts and labour prices',
      'Approve or decline each fault; approvals create the work and the cost',
      'Repairs completed by the inspector flow back and move the bike on',
      'Inspection mode gives mechanics a clean screen with nothing to click by mistake',
    ],
  },
  {
    title: 'Parts and components',
    summary: 'A proper parts inventory and a growing component library.',
    points: [
      'Stock of new and second-hand parts with cost, sale price and status',
      'Break a bike for parts and every component lands in stock automatically',
      'Fit parts to a bike and the cost follows the bike',
      'Component library by category, brand and model, enriched every time you look a bike up',
    ],
  },
  {
    title: 'Bike builder quotes',
    summary: 'Price a custom build line by line and see the margin before you commit.',
    points: [
      'Build a quote from your component library',
      'Standard 20% VAT or the margin scheme (no VAT on parts, one sixth of the margin at the end)',
      'Live totals, margin and return on investment as you type',
      'Saved versions so you can see how a quote changed',
    ],
  },
  {
    title: 'Sales, invoicing and VAT',
    summary: 'Record the sale once and everything else follows.',
    points: [
      'Sale dialog capturing the real sale price, the customer and the delivery choice',
      'Invoices with VAT-qualifying, margin scheme or commercial VAT treatment',
      'Part exchange handled on the same invoice, with the incoming bike created for you',
      'Save a sale as a draft and finish it later',
      'Reverse a sale and the invoice, ledger entries and stock all unwind',
    ],
  },
  {
    title: 'Accounting',
    summary: 'QuickBooks Online kept in step without double entry.',
    points: [
      'Connect QuickBooks once and stay connected',
      'Purchases post to stock when a bike arrives',
      'Sale invoices, margin VAT and cost of sale post when a bike sells',
      'Errors are visible on the bike so nothing quietly fails',
    ],
  },
  {
    title: 'Logistics',
    summary: 'Collections from sellers and deliveries to buyers, booked from the app.',
    points: [
      'Book a collection with Cycle Courier Co straight from the bike',
      'Book a delivery to the customer when you record the sale',
      'Live status updates arrive automatically and mark the bike collected or delivered',
      'One logistics board showing everything in motion',
    ],
  },
  {
    title: 'Selling online',
    summary: 'List a bike everywhere from one place, and pull it down when it sells.',
    points: [
      'Shopify: bikes list automatically when they are ready and go to zero stock when sold',
      'eBay: automatic listing with per-bike condition and category, plus manual controls',
      'Shopify orders mark the bike sold in VeloDealer',
      'Listing text templates for eBay, Shopify, Instagram and Facebook, built from the bike\'s own fields',
    ],
  },
  {
    title: 'Customer bike submissions',
    summary: 'Turn Typeform enquiries into stock without retyping anything.',
    points: [
      'Connect your Typeform account and choose which forms feed the system',
      'Submissions arrive in an inbox with photos copied into your own storage',
      'Accept a submission and the bike is created ready for collection',
    ],
  },
  {
    title: 'Storage and labelling',
    summary: 'Know where every bike physically is.',
    points: [
      'Storage bays with zones, names and notes',
      'Assign a bay on intake and change it any time',
      'Print labels one at a time or for a whole batch',
    ],
  },
  {
    title: 'Investor bikes',
    summary: 'Bring in funding and keep everyone honest about the numbers.',
    points: [
      'Mark a bike as investor funded with an agreed profit share',
      'Investors sign in and see only their own bikes',
      'The same cost and profit breakdown the admin team sees',
    ],
  },
  {
    title: 'Reporting',
    summary: 'Live numbers, not a spreadsheet you update on Fridays.',
    points: [
      'Stock ageing, sales pipeline, margin analysis, revenue and inventory turnover',
      'Stock investment value across the whole floor',
      'Full cost breakdown per bike: purchase, collection, delivery, parts and labour',
      'Staff activity by person and day across intake, inspections, repairs and sales',
    ],
  },
  {
    title: 'Marketing',
    summary: 'Plan the content that sells the bikes.',
    points: [
      'Social post planner with calendar, scripts and checklists',
      'Performance scoring and metrics per post',
      'Posts linked to the bike they feature',
    ],
  },
  {
    title: 'Team and notifications',
    summary: 'The right people see the right things.',
    points: [
      'Roles for admin, owner, mechanic, detailer, accountant, social manager and investor',
      'Email notifications for new submissions, repairs awaiting approval and logistics updates',
      'Password reset and account emails sent from your own domain',
    ],
  },
];

export default function FeaturesPage() {
  return (
    <PublicLayout
      title="Features"
      description="Everything VeloDealer does: bike intake, workshop jobs, inspections, parts, quotes, sales and VAT, QuickBooks, logistics, Shopify and eBay listings, reporting and more."
    >
      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-16">
          <h1 className="font-display text-[40px] font-bold leading-tight text-foreground md:text-[56px]">
            Everything VeloDealer does
          </h1>
          <p className="mt-4 max-w-[65ch] text-lg text-muted-foreground">
            One system for the whole life of a bike — from the moment it arrives to the invoice, the
            courier and the accounts.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Get started</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/contact">Talk to us</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4">
        <div className="divide-y divide-border">
          {groups.map((group, i) => (
            <div
              key={group.title}
              className={`grid gap-6 py-12 md:grid-cols-2 md:gap-12 ${i % 2 === 1 ? 'md:[&>*:first-child]:order-2' : ''}`}
            >
              <div>
                <h2 className="font-display text-[26px] font-bold text-foreground">{group.title}</h2>
                <p className="mt-3 max-w-[60ch] text-muted-foreground">{group.summary}</p>
              </div>
              <div className="rounded-[4px] border border-border bg-card">
                {group.points.map((point) => (
                  <div key={point} className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <span className="text-sm text-foreground">{point}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border">
        <div className="container mx-auto px-4 py-16 text-center">
          <h2 className="font-display text-[28px] font-bold text-foreground">Put your stock on the board.</h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><Link to="/auth">Get started</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/pricing">See pricing</Link></Button>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
