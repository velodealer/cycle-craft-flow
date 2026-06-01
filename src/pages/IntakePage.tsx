import { useEffect, useState } from 'react';
import IntakeForm from '@/components/intake/IntakeForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ClipboardCheck, ArrowLeft, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PendingBike {
  id: string;
  make: string;
  model: string;
  frame_number: string | null;
  source: string;
  status: string;
  intake_date: string;
}

export default function IntakePage() {
  const [showForm, setShowForm] = useState(false);
  const [processBikeId, setProcessBikeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingBike[]>([]);
  const [stats, setStats] = useState({ today: 0, week: 0, pending: 0 });

  const load = async () => {
    setLoading(true);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [pendingRes, todayRes, weekRes] = await Promise.all([
      supabase
        .from('bikes')
        .select('id, make, model, frame_number, source, status, intake_date')
        .in('status', ['pending_intake', 'intake'])
        .order('intake_date', { ascending: true }),
      supabase
        .from('bikes')
        .select('id', { count: 'exact', head: true })
        .gte('intake_date', startOfToday.toISOString()),
      supabase
        .from('bikes')
        .select('id', { count: 'exact', head: true })
        .gte('intake_date', weekAgo.toISOString()),
    ]);

    setPending((pendingRes.data || []) as PendingBike[]);
    setStats({
      today: todayRes.count || 0,
      week: weekRes.count || 0,
      pending: pendingRes.data?.length || 0,
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSuccess = () => {
    setShowForm(false);
    load();
  };

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => setShowForm(false)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Bike Intake</h1>
            <p className="text-muted-foreground">Process a new bike into the system</p>
          </div>
        </div>
        <IntakeForm onSuccess={handleSuccess} onCancel={() => setShowForm(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bike Intake</h1>
        <p className="text-muted-foreground">
          Streamlined process for adding new bikes to the system
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setShowForm(true)}>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-4 bg-primary/10 rounded-full w-fit">
              <ClipboardCheck className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Start New Intake</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              Begin the intake process for a new bike
            </p>
            <Button className="w-full">Start Intake</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Today's Intakes</span>
              <span className="font-medium">{loading ? '…' : stats.today}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">This Week</span>
              <span className="font-medium">{loading ? '…' : stats.week}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pending Intake</span>
              <span className="font-medium">{loading ? '…' : stats.pending}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bikes Awaiting Intake</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No bikes are currently awaiting intake.
            </p>
          ) : (
            <div className="space-y-2">
              {pending.map((bike) => (
                <div
                  key={bike.id}
                  className="flex flex-col gap-3 p-4 border rounded-lg sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {bike.make} {bike.model}
                      </span>
                      <Badge variant={bike.status === 'pending_intake' ? 'secondary' : 'default'}>
                        {bike.status === 'pending_intake' ? 'Delivered' : 'Intake'}
                      </Badge>
                      <Badge variant="outline">
                        {bike.source === 'owned' ? 'Owned' : 'Consignment'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {bike.frame_number && <>Frame: {bike.frame_number} • </>}
                      Arrived {new Date(bike.intake_date).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setProcessBikeId(bike.id)}
                    className="w-full sm:w-auto"
                  >
                    Process intake
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!processBikeId} onOpenChange={(open) => !open && setProcessBikeId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Process Intake</DialogTitle>
          </DialogHeader>
          {processBikeId && (
            <IntakeForm
              preselectedBikeId={processBikeId}
              onSuccess={() => {
                setProcessBikeId(null);
                load();
              }}
              onCancel={() => setProcessBikeId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
