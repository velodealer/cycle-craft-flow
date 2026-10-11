import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LogisticsList from "@/components/logistics/LogisticsList";
import LinkCourierOrderDialog from "@/components/logistics/LinkCourierOrderDialog";
import { PageHeader, Panel } from '@/components/velo/PageShell';

const LogisticsPage = () => {
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshAll = async () => {
    setRefreshing(true);
    const { data, error } = await supabase.functions.invoke("cycle-courier-order-sync", { body: { all: true } });
    setRefreshing(false);
    if (error || data?.error) { toast.error(data?.error || error?.message || "Refresh failed"); return; }
    const failed = (data?.results ?? []).filter((r: any) => r.error).length;
    toast.success(`Checked ${data?.checked ?? 0} bookings with Cycle Courier${failed ? ` (${failed} could not be read)` : ""}`);
    setReloadKey((k) => k + 1);
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Logistics"
        description="Collections and deliveries, booked through Cycle Courier Co."
      />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={refreshAll} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh all
        </Button>
        <LinkCourierOrderDialog onLinked={() => setReloadKey((k) => k + 1)} />
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Collections</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <Panel title="Active collections" hint="Bikes being collected or in transit" bodyClassName="p-0 sm:p-4">
            <LogisticsList key={`a${reloadKey}`} status="active" />
          </Panel>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <Panel title="Completed" hint="Delivered and closed movements" bodyClassName="p-0 sm:p-4">
            <LogisticsList key={`c${reloadKey}`} status="completed" />
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LogisticsPage;
