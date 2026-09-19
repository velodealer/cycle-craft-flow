import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LogisticsList from "@/components/logistics/LogisticsList";
import { PageHeader, Panel } from '@/components/velo/PageShell';

const LogisticsPage = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Logistics"
        description="Collections and deliveries, booked through Cycle Courier Co."
      />

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Collections</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <Panel title="Active collections" hint="Bikes being collected or in transit" bodyClassName="p-0 sm:p-4">
            <LogisticsList status="active" />
          </Panel>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <Panel title="Completed" hint="Delivered and closed movements" bodyClassName="p-0 sm:p-4">
            <LogisticsList status="completed" />
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LogisticsPage;
