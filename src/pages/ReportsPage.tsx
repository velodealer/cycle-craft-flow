import { useMemo, useState } from 'react';
import TimeframePicker from '@/components/reports/TimeframePicker';
import ReportFilters from '@/components/reports/ReportFilters';
import KpiStrip from '@/components/reports/KpiStrip';
import SalesPerformanceSection from '@/components/reports/SalesPerformanceSection';
import ProfitabilitySection from '@/components/reports/ProfitabilitySection';
import BrandAnalyticsSection from '@/components/reports/BrandAnalyticsSection';
import SpecAnalyticsSection from '@/components/reports/SpecAnalyticsSection';
import StockInsightsSection from '@/components/reports/StockInsightsSection';
import OperationsSection from '@/components/reports/OperationsSection';
import AcquisitionSection from '@/components/reports/AcquisitionSection';
import CashflowSection from '@/components/reports/CashflowSection';
import InventoryTurnoverSection from '@/components/reports/InventoryTurnoverSection';
import SalesPipelineSection from '@/components/reports/SalesPipelineSection';
import { comparisonRange, presetRange, rangeLabel, type CompareMode } from '@/lib/reports';
import { applyFilters, buildBikeRows, EMPTY_FILTERS, type ReportFilterState } from '@/lib/reportMetrics';
import { useReportsData } from '@/hooks/useReportsData';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/velo/PageShell';

export default function ReportsPage() {
  const [preset, setPreset] = useState('90d');
  const [range, setRange] = useState(presetRange('90d'));
  const [compare, setCompare] = useState<CompareMode>('prev');
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY_FILTERS);
  const { data, loading, error, reload } = useReportsData(range);

  const compareRange = useMemo(() => comparisonRange(range, compare), [range, compare]);
  const allRows = useMemo(() => (data ? buildBikeRows(data) : []), [data]);
  const rows = useMemo(() => applyFilters(allRows, filters), [allRows, filters]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Where margin is made, what's sitting too long, and how fast stock turns."
        actions={
          <TimeframePicker
            preset={preset}
            range={range}
            compare={compare}
            onChange={(p, r) => { setPreset(p); setRange(r); }}
            onCompareChange={setCompare}
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ReportFilters rows={allRows} value={filters} onChange={setFilters} />
            <p className="text-xs text-muted-foreground">
              {rangeLabel(range)}
              {compareRange ? ` vs ${rangeLabel(compareRange)}` : ''} · {rows.length} bikes in scope
            </p>
          </div>

          <KpiStrip rows={rows} data={data} range={range} compareRange={compareRange} />

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="sales">Sales</TabsTrigger>
              <TabsTrigger value="margin">Margin</TabsTrigger>
              <TabsTrigger value="brands">Brands</TabsTrigger>
              <TabsTrigger value="spec">Spec & sizes</TabsTrigger>
              <TabsTrigger value="stock">Stock & ageing</TabsTrigger>
              <TabsTrigger value="operations">Operations</TabsTrigger>
              <TabsTrigger value="buying">Buying & channels</TabsTrigger>
              <TabsTrigger value="cash">Cash</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <SalesPipelineSection data={data} range={range} />
              <SalesPerformanceSection rows={rows} data={data} range={range} compareRange={compareRange} />
              <InventoryTurnoverSection data={data} range={range} />
            </TabsContent>

            <TabsContent value="sales">
              <SalesPerformanceSection rows={rows} data={data} range={range} compareRange={compareRange} />
            </TabsContent>

            <TabsContent value="margin">
              <ProfitabilitySection rows={rows} range={range} />
            </TabsContent>

            <TabsContent value="brands">
              <BrandAnalyticsSection rows={rows} range={range} />
            </TabsContent>

            <TabsContent value="spec">
              <SpecAnalyticsSection rows={rows} range={range} />
            </TabsContent>

            <TabsContent value="stock">
              <StockInsightsSection rows={rows} data={data} range={range} />
            </TabsContent>

            <TabsContent value="operations">
              <OperationsSection rows={rows} data={data} range={range} />
            </TabsContent>

            <TabsContent value="buying">
              <AcquisitionSection rows={rows} data={data} range={range} />
            </TabsContent>

            <TabsContent value="cash">
              <CashflowSection rows={rows} data={data} range={range} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
