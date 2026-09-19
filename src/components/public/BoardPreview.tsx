import { StageFlap } from "@/components/velo/StageFlap";
import { cn } from "@/lib/utils";

interface Row {
  bike: string;
  reference: string;
  stage: string;
  source: string;
  location: string;
  cost: string;
  asking: string;
  margin?: string;
  added: string;
}

const ROWS: Row[] = [
  { bike: "2022 Trek Domane SL6", reference: "TDX·0412", stage: "listed", source: "Owner", location: "Bay 4", cost: "£1,400", asking: "£2,150", margin: "+34%", added: "12 Sep" },
  { bike: "2023 Orbea Gain M20", reference: "OGN·0398", stage: "repair", source: "Trade-in", location: "Bay 2", cost: "£1,750", asking: "£—", added: "14 Sep" },
  { bike: "2021 Canyon Grail 7", reference: "CGZ·0371", stage: "inspection", source: "Part exchange", location: "Bench 1", cost: "£980", asking: "£1,595", margin: "+38%", added: "15 Sep" },
  { bike: "2024 Specialized Allez", reference: "SPA·0426", stage: "pending_approval", source: "Owner", location: "Bay 1", cost: "£640", asking: "£1,050", margin: "+39%", added: "16 Sep" },
  { bike: "2020 Giant Defy Advanced", reference: "GDA·0355", stage: "sold", source: "Owner", location: "Collected", cost: "£1,120", asking: "£1,780", margin: "+37%", added: "02 Sep" },
];

/** A static, demo-data rendering of the bikes board — the product surface used as the marketing image. */
export function BoardPreview({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[4px] border border-border bg-card", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="font-display text-base font-semibold text-foreground">Bikes</h3>
        <span className="label-text text-muted-foreground">Example board · demo figures</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Bike", "Stage", "Source", "Location", "Cost → asking", "Added"].map((h) => (
                <th key={h} className="label-text px-4 py-2 text-left font-medium text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.reference} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{r.bike}</div>
                  <div className="id-text text-xs text-muted-foreground">{r.reference}</div>
                </td>
                <td className="px-4 py-3"><StageFlap stage={r.stage} size="sm" /></td>
                <td className="px-4 py-3 text-muted-foreground">{r.source}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.location}</td>
                <td className="px-4 py-3">
                  <span className="tabular text-foreground">{r.cost}</span>
                  <span className="text-muted-foreground"> → </span>
                  <span className="tabular text-foreground">{r.asking}</span>
                  {r.margin && <span className="tabular ml-2 text-gain">{r.margin}</span>}
                </td>
                <td className="id-text px-4 py-3 text-muted-foreground">{r.added}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default BoardPreview;
