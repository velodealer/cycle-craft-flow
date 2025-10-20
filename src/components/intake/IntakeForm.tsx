import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PhotoUpload from '@/components/PhotoUpload';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { QrCode, ArrowRight, Search } from 'lucide-react';

const intakeSchema = z.object({
  bike_id: z.string().min(1, 'Bike selection is required'),
  frame_number: z.string().min(1, 'Frame number is required'),
  accessories_included: z.string().optional(),
});

interface IntakeFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface Bike {
  id: string;
  make: string;
  model: string;
  year?: number;
  frame_number?: string;
  status: string;
  photos?: string[];
  owner_name?: string;
  external_owner?: {
    name: string;
    email?: string;
  };
}

export default function IntakeForm({ onSuccess, onCancel }: IntakeFormProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [serialPhotos, setSerialPhotos] = useState<string[]>([]);
  const [registerPhotos, setRegisterPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [selectedBike, setSelectedBike] = useState<Bike | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [labelGenerated, setLabelGenerated] = useState(false);
  
  // Checklist state
  const [checklist, setChecklist] = useState({
    photosTaken: false,
    accessoriesLogged: false,
    frameNumberRecorded: false,
    serialPhotoTaken: false,
    registerPhotoTaken: false,
  });

  const { profile } = useAuth();

  const form = useForm<z.infer<typeof intakeSchema>>({
    resolver: zodResolver(intakeSchema),
    defaultValues: {
      bike_id: '',
      frame_number: '',
      accessories_included: '',
    },
  });

  // Load bikes that are ready for intake
  useEffect(() => {
    const loadBikes = async () => {
      try {
        const { data, error } = await supabase
          .from('bikes')
          .select(`
            id,
            make,
            model,
            year,
            frame_number,
            status,
            photos,
            external_owners!bikes_external_owner_id_fkey (
              name,
              email
            )
          `)
          .in('status', ['pending_intake'])
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        const formattedBikes = (data || []).map(bike => ({
          ...bike,
          external_owner: bike.external_owners,
        }));
        
        setBikes(formattedBikes);
      } catch (error: any) {
        toast({
          title: 'Error loading bikes',
          description: error.message,
          variant: 'destructive',
        });
      }
    };

    loadBikes();
  }, []);

  // Update checklist based on form data and selected bike
  useEffect(() => {
    const frameNumber = form.watch('frame_number');
    const accessories = form.watch('accessories_included');
    
    setChecklist(prev => ({
      ...prev,
      photosTaken: photos.length > 0,
      accessoriesLogged: Boolean(accessories && accessories.trim()),
      frameNumberRecorded: Boolean(frameNumber && frameNumber.trim()),
      serialPhotoTaken: serialPhotos.length > 0,
      registerPhotoTaken: registerPhotos.length > 0,
    }));
  }, [photos, serialPhotos, registerPhotos, form.watch('frame_number'), form.watch('accessories_included')]);

  // Update form when bike is selected
  useEffect(() => {
    if (selectedBike) {
      form.setValue('bike_id', selectedBike.id);
      form.setValue('frame_number', selectedBike.frame_number || '');
    }
  }, [selectedBike, form]);

  const filteredBikes = bikes.filter(bike =>
    searchTerm === '' ||
    bike.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bike.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (bike.frame_number && bike.frame_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (bike.external_owner?.name && bike.external_owner.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const generateLabel = () => {
    if (!selectedBike) {
      toast({
        title: 'Select a bike',
        description: 'Please select a bike before generating a label',
        variant: 'destructive',
      });
      return;
    }

    const frameNumber = form.getValues('frame_number');
    if (!frameNumber) {
      toast({
        title: 'Frame number required',
        description: 'Frame number must be recorded to generate a label',
        variant: 'destructive',
      });
      return;
    }

    // Simulate label generation
    setLabelGenerated(true);
    toast({ title: 'Label generated successfully' });
  };

  const onSubmit = async (values: z.infer<typeof intakeSchema>) => {
    if (!selectedBike) {
      toast({
        title: 'Select a bike',
        description: 'Please select a bike to perform intake on',
        variant: 'destructive',
      });
      return;
    }

    // Check if all checklist items are completed
    const allChecked = Object.values(checklist).every(Boolean);
    if (!allChecked) {
      toast({
        title: 'Complete intake checklist',
        description: 'All checklist items must be completed before saving',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      // Update the bike with intake status and new information
      const updateData = {
        frame_number: values.frame_number,
        accessories_included: values.accessories_included,
        photos: [...(selectedBike.photos || []), ...photos, ...serialPhotos, ...registerPhotos],
        status: 'intake' as const,
        intake_date: new Date().toISOString(),
      };

      const { error: bikeError } = await supabase
        .from('bikes')
        .update(updateData)
        .eq('id', values.bike_id);

      if (bikeError) throw bikeError;

      toast({ title: 'Bike intake completed successfully' });
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isChecklistComplete = Object.values(checklist).every(Boolean);

  // If no bike is selected, show bike selection
  if (!selectedBike) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Select Bike for Intake</CardTitle>
            <p className="text-sm text-muted-foreground">
              Choose a bike to perform the intake process on
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bikes by make, model, frame number, or owner..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bike</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Frame Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBikes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No bikes available for intake
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBikes.map((bike) => (
                      <TableRow key={bike.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{bike.make} {bike.model}</div>
                            {bike.year && <div className="text-sm text-muted-foreground">{bike.year}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {bike.external_owner?.name || 'No owner assigned'}
                          </div>
                          {bike.external_owner?.email && (
                            <div className="text-sm text-muted-foreground">
                              {bike.external_owner.email}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {bike.frame_number || 'Not recorded'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {bike.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => setSelectedBike(bike)}
                            className="flex items-center gap-2"
                          >
                            Select
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show intake form for selected bike
  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Selected Bike</CardTitle>
              <p className="text-sm text-muted-foreground">
                Performing intake on: {selectedBike.make} {selectedBike.model}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setSelectedBike(null)}
            >
              Change Bike
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium">Owner:</span>
              <div className="text-muted-foreground">
                {selectedBike.external_owner?.name || 'Not assigned'}
              </div>
            </div>
            <div>
              <span className="font-medium">Year:</span>
              <div className="text-muted-foreground">{selectedBike.year || 'Not recorded'}</div>
            </div>
            <div>
              <span className="font-medium">Current Status:</span>
              <div>
                <Badge variant="outline">
                  {selectedBike.status.replace('_', ' ')}
                </Badge>
              </div>
            </div>
            <div>
              <span className="font-medium">Frame Number:</span>
              <div className="text-muted-foreground">
                {selectedBike.frame_number || 'Not recorded'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Frame Number */}
          <Card>
            <CardHeader>
              <CardTitle>Intake Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="frame_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frame Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="Serial number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="accessories_included"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accessories Included</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="List any accessories, parts, or extras included..."
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Photos */}
          <Card>
            <CardHeader>
              <CardTitle>Intake Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <PhotoUpload
                bucket="bike-photos"
                path={`intake-${selectedBike.id}`}
                photos={photos}
                onChange={setPhotos}
                maxPhotos={10}
              />
            </CardContent>
          </Card>

          {/* Serial Number Photo */}
          <Card>
            <CardHeader>
              <CardTitle>Serial Number Verification</CardTitle>
              <p className="text-sm text-muted-foreground">
                Take a clear photo of the bike's serial number for verification
              </p>
            </CardHeader>
            <CardContent>
              <PhotoUpload
                bucket="bike-photos"
                path={`serial-${selectedBike.id}`}
                photos={serialPhotos}
                onChange={setSerialPhotos}
                maxPhotos={3}
              />
            </CardContent>
          </Card>

          {/* Bike Register Check */}
          <Card>
            <CardHeader>
              <CardTitle>Bike Register Check</CardTitle>
              <p className="text-sm text-muted-foreground">
                Upload photo to check against stolen bike register
              </p>
            </CardHeader>
            <CardContent>
              <PhotoUpload
                bucket="bike-photos"
                path={`register-check-${selectedBike.id}`}
                photos={registerPhotos}
                onChange={setRegisterPhotos}
                maxPhotos={2}
              />
            </CardContent>
          </Card>

          {/* Intake Checklist */}
          <Card>
            <CardHeader>
              <CardTitle>Intake Checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    checked={checklist.photosTaken} 
                    disabled
                    id="photos"
                  />
                  <label htmlFor="photos" className="text-sm font-medium">
                    Photos taken ({photos.length} photos)
                  </label>
                  {checklist.photosTaken && <Badge variant="secondary">✓</Badge>}
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    checked={checklist.accessoriesLogged} 
                    disabled
                    id="accessories"
                  />
                  <label htmlFor="accessories" className="text-sm font-medium">
                    Accessories logged
                  </label>
                  {checklist.accessoriesLogged && <Badge variant="secondary">✓</Badge>}
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    checked={checklist.frameNumberRecorded} 
                    disabled
                    id="frame"
                  />
                  <label htmlFor="frame" className="text-sm font-medium">
                    Frame number recorded
                  </label>
                  {checklist.frameNumberRecorded && <Badge variant="secondary">✓</Badge>}
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    checked={checklist.serialPhotoTaken} 
                    disabled
                    id="serial"
                  />
                  <label htmlFor="serial" className="text-sm font-medium">
                    Serial number photo taken ({serialPhotos.length} photos)
                  </label>
                  {checklist.serialPhotoTaken && <Badge variant="secondary">✓</Badge>}
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    checked={checklist.registerPhotoTaken} 
                    disabled
                    id="register"
                  />
                  <label htmlFor="register" className="text-sm font-medium">
                    Bike register check photo ({registerPhotos.length} photos)
                  </label>
                  {checklist.registerPhotoTaken && <Badge variant="secondary">✓</Badge>}
                </div>
              </div>

              {isChecklistComplete && (
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Generate Bike Label</p>
                      <p className="text-xs text-muted-foreground">Create QR code label for bike tracking</p>
                    </div>
                    <Button
                      type="button"
                      variant={labelGenerated ? "secondary" : "outline"}
                      onClick={generateLabel}
                      disabled={labelGenerated}
                      className="flex items-center gap-2"
                    >
                      <QrCode className="h-4 w-4" />
                      {labelGenerated ? 'Label Generated' : 'Generate Label'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={submitting || !isChecklistComplete}
            >
              {submitting ? 'Processing...' : 'Complete Intake'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}