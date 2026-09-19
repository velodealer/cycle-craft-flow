import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/public/PublicLayout";
import BoardPreview from "@/components/public/BoardPreview";
import PipelineFlaps from "@/components/public/PipelineFlaps";
import { StatBlock } from "@/components/velo/StatBlock";

const AREAS = [
  {
    label: "Workshop",
    title: "Every bike moves through the same eight stages",
    body: "Intake, cleaning, inspection, owner approval, repair, ready, listed, sold. Faults come back from InspectABike, get costed, approved and repaired — mechanics never see a price.",
    rows: [
      ["Cleaning", "2 bikes on the bench"],
      ["Inspection", "3 waiting, oldest 2 days"],
      ["Owner approval", "£67 of work on OGN·0398"],
    ],
  },
  {
    label: "Selling",
    title: "List once, delist everywhere it sells",
    body: "Shopify and eBay listings are pushed from the bike record with your own descriptions and templates. Sell on one channel and the other comes down.",
    rows: [
      ["Shopify", "12 bikes live"],
      ["eBay", "8 bikes live"],
      ["Sold this week", "3 bikes, £5,420"],
    ],
  },
  {
    label: "Money",
    title: "Cost, margin and VAT on every bike",
    body: "Purchase price, parts, labour and prep roll into one figure against the asking price. Sales post to QuickBooks with margin-scheme VAT handled.",
    rows: [
      ["Stock at cost", "£41,200"],
      ["Average margin", "31%"],
      ["Awaiting QuickBooks sync", "0"],
    ],
  },
];

const PARTNERS = ["Shopify", "eBay", "QuickBooks", "InspectABike", "Cycle Courier Co", "Typeform"];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      {/* Hero */}
      <section className="container mx-auto px-4 pb-10 pt-16 md:pt-24">
        <div className="max-w-4xl">
          <h1 className="font-display text-[42px] font-bold leading-[1.05] text-foreground md:text-[68px]">
            Run your bike business
            <br />
            like a trading desk.
          </h1>
          <p className="mt-6 max-w-[60ch] text-lg text-muted-foreground">
            Every bike staged, priced and margined — from intake to delivery.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button size="lg" onClick={() => navigate("/auth")}>
              Get started <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <a href="#see-it-work" className="text-sm font-medium text-foreground hover:text-primary">
              See it work ↓
            </a>
          </div>
        </div>

        <div id="see-it-work" className="mt-12">
          <BoardPreview />
        </div>
      </section>

      {/* Stat strip */}
      <section className="border-y border-border bg-card">
        <div className="container mx-auto grid gap-8 px-4 py-10 sm:grid-cols-3">
          <StatBlock label="Stock at cost" value="£41,200" delta="8%" deltaDirection="up" />
          <StatBlock label="Average margin" value="31%" />
          <StatBlock label="Days to sold" value="18" hint="3 days quicker than last quarter" />
        </div>
        <div className="container mx-auto px-4 pb-6">
          <p className="text-xs text-muted-foreground">Example figures from a dealer's first quarter on VeloDealer.</p>
        </div>
      </section>

      {/* Pipeline */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="font-display text-[28px] font-bold text-foreground md:text-[34px]">The pipeline</h2>
        <p className="mt-2 max-w-[70ch] text-muted-foreground">
          One board, one status per bike. Anyone in the shop can see where a bike is and what it is waiting on.
        </p>
        <PipelineFlaps className="mt-6" />

        <div className="mt-12 divide-y divide-border border-y border-border">
          {AREAS.map((area) => (
            <div key={area.label} className="grid gap-6 py-10 md:grid-cols-[1fr,1fr] md:gap-12">
              <div>
                <p className="label-text text-primary">{area.label}</p>
                <h3 className="mt-2 font-display text-[24px] font-bold text-foreground">{area.title}</h3>
                <p className="mt-3 max-w-[60ch] text-muted-foreground">{area.body}</p>
              </div>
              <div className="rounded-[4px] border border-border bg-card">
                {area.rows.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 border-b border-border px-4 py-4 last:border-b-0"
                  >
                    <span className="label-text text-muted-foreground">{label}</span>
                    <span className="tabular text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Partners */}
      <section className="border-y border-border bg-card">
        <div className="container mx-auto px-4 py-10">
          <h2 className="font-display text-lg font-semibold text-foreground">Works with what you already use</h2>
          <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3">
            {PARTNERS.map((p) => (
              <span key={p} className="font-display text-lg font-semibold text-muted-foreground">
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-start justify-between gap-4 rounded-[4px] border border-border bg-card p-6 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-[24px] font-bold text-foreground">Three plans, one book of stock</h2>
            <p className="mt-2 max-w-[60ch] text-muted-foreground">
              Starter, Pro and Business. Free on the Shopify App Store — the full app, billed through Shopify.
            </p>
          </div>
          <Button variant="outline" size="lg" asChild>
            <Link to="/pricing">See pricing</Link>
          </Button>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border">
        <div className="container mx-auto px-4 py-20 text-center">
          <h2 className="font-display text-[30px] font-bold text-foreground md:text-[40px]">
            Put your stock on the board.
          </h2>
          <p className="mx-auto mt-3 max-w-[55ch] text-muted-foreground">
            Set up your book, bring your bikes in, and see margin on every one of them.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate("/auth")}>
              Get started <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/contact">Talk to us</Link>
            </Button>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
