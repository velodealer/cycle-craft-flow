import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  features?: string[];
}

export default function PlaceholderPage({ title, description, icon: Icon, features = [] }: PlaceholderPageProps) {
  const { toast } = useToast();

  const handleFeatureClick = (feature: string) => {
    toast({
      title: "Coming Soon",
      description: `${feature} functionality is under development.`,
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="bg-accent rounded-lg p-3">
          <Icon className="h-8 w-8 text-accent-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Under Development</CardTitle>
          <CardDescription>
            This module is currently being developed. Here's what's planned:
          </CardDescription>
        </CardHeader>
        <CardContent>
          {features.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-medium">Planned Features:</h4>
              <div className="grid gap-2">
                {features.map((feature, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="justify-start h-auto p-4"
                    onClick={() => handleFeatureClick(feature)}
                  >
                    <div className="text-left">
                      <div className="font-medium">{feature}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Feature specifications coming soon...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}