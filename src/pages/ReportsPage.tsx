import { useState } from 'react';
import TimeframePicker from '@/components/reports/TimeframePicker';
import KpiStrip from '@/components/reports/KpiStrip';
import SalesPipelineSection from '@/components/reports/SalesPipelineSection';
import StockAgingSection from '@/components/reports/StockAgingSection';
import MarginAnalysisSection from '@/components/reports/MarginAnalysisSection';
import RevenueTrackingSection from '@/components/reports/RevenueTrackingSection';
import InventoryTurnoverSection from '@/components/reports/InventoryTurnoverSection';
import { presetRange } from '@/lib/reports';
import { useReportsData } from '@/hooks/useReportsData';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/velo/PageShell';

export default function ReportsPage() {
  const [preset, setPreset] = useState('90d');
  const [range, setRange] = useState(presetRange('90d'));
  const { data, loading, error, reload } = useReportsData(range);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Where margin is made, what's sitting too long, and how fast stock turns."
        actions={
          <TimeframePicker
            preset={preset}
            range={range}
            onChange={(p, r) => { setPreset(p); setRange(r); }}
          />
        }
      />

      {error && (
        <div className="rounded-[4px] border border-destructive/50 bg-destructive/10 p-4 flex items-center justify-between text-sm">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={reload}>Retry</Button>
        </div>
      )}

      {loading || !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <>
          <KpiStrip data={data} range={range} />
          <SalesPipelineSection data={data} range={range} />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <RevenueTrackingSection data={data} range={range} />
            <StockAgingSection data={data} />
          </div>
          <MarginAnalysisSection data={data} range={range} />
          <InventoryTurnoverSection data={data} range={range} />
        </>
      )}
    </div>
  );
}
