import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import LogisticsList from "@/components/logistics/LogisticsList";

const LogisticsPage = () => {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Logistics</h1>
        <p className="text-muted-foreground mt-2">
          Track bike collections and deliveries via Cycle Courier Co.
        </p>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Collections</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Collections</CardTitle>
              <CardDescription>
                Bikes currently being collected or in transit
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LogisticsList status="active" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Completed Collections</CardTitle>
              <CardDescription>
                Historical record of delivered bikes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LogisticsList status="completed" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LogisticsPage;
