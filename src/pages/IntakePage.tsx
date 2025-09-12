import { useState } from 'react';
import IntakeForm from '@/components/intake/IntakeForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardCheck, ArrowLeft } from 'lucide-react';

export default function IntakePage() {
  const [showForm, setShowForm] = useState(false);

  const handleSuccess = () => {
    setShowForm(false);
  };

  const handleCancel = () => {
    setShowForm(false);
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
        
        <IntakeForm onSuccess={handleSuccess} onCancel={handleCancel} />
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
            <Button className="w-full">
              Start Intake
            </Button>
          </CardContent>
        </Card>

        <Card className="border-dashed border-2">
          <CardHeader className="text-center">
            <CardTitle className="text-muted-foreground">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-center text-sm">
            <div className="flex justify-between">
              <span>Today's Intakes:</span>
              <span className="font-medium">3</span>
            </div>
            <div className="flex justify-between">
              <span>This Week:</span>
              <span className="font-medium">12</span>
            </div>
            <div className="flex justify-between">
              <span>Pending Processing:</span>
              <span className="font-medium">7</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed border-2">
          <CardHeader className="text-center">
            <CardTitle className="text-muted-foreground">Intake Process</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-primary rounded-full"></div>
              <span>Owner details</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-primary rounded-full"></div>
              <span>Bike information</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-primary rounded-full"></div>
              <span>Photo documentation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-primary rounded-full"></div>
              <span>Intake checklist</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-primary rounded-full"></div>
              <span>Label generation</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}