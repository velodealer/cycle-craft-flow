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
import PhotoUpload from '@/components/PhotoUpload';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { QrCode, Plus, User } from 'lucide-react';

const intakeSchema = z.object({
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  frame_number: z.string().min(1, 'Frame number is required'),
  external_owner_id: z.string().min(1, 'Owner is required'),
  accessories_included: z.string().optional(),
  source: z.enum(['owned', 'customer_consignment']).default('customer_consignment'),
});

interface IntakeFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface Owner {
  id: string;
  name: string;
  email: string | null;
}

export default function IntakeForm({ onSuccess, onCancel }: IntakeFormProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [showNewOwnerForm, setShowNewOwnerForm] = useState(false);
  const [newOwner, setNewOwner] = useState({ name: '', email: '', phone: '' });
  const [labelGenerated, setLabelGenerated] = useState(false);
  
  // Checklist state
  const [checklist, setChecklist] = useState({
    photosTaken: false,
    accessoriesLogged: false,
    frameNumberRecorded: false,
  });

  const { profile } = useAuth();

  const form = useForm<z.infer<typeof intakeSchema>>({
    resolver: zodResolver(intakeSchema),
    defaultValues: {
      make: '',
      model: '',
      frame_number: '',
      external_owner_id: '',
      accessories_included: '',
      source: 'customer_consignment',
    },
  });

  // Load owners
  useEffect(() => {
    const loadOwners = async () => {
      try {
        const { data, error } = await supabase
          .from('external_owners')
          .select('id, name, email')
          .order('name');

        if (error) throw error;
        setOwners(data || []);
      } catch (error: any) {
        toast({
          title: 'Error loading owners',
          description: error.message,
          variant: 'destructive',
        });
      }
    };

    loadOwners();
  }, []);

  // Update checklist based on form data
  useEffect(() => {
    const frameNumber = form.watch('frame_number');
    const accessories = form.watch('accessories_included');
    
    setChecklist(prev => ({
      ...prev,
      photosTaken: photos.length > 0,
      accessoriesLogged: Boolean(accessories && accessories.trim()),
      frameNumberRecorded: Boolean(frameNumber && frameNumber.trim()),
    }));
  }, [photos, form.watch('frame_number'), form.watch('accessories_included')]);

  const handleAddOwner = async () => {
    if (!newOwner.name.trim()) {
      toast({
        title: 'Error',
        description: 'Owner name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('external_owners')
        .insert({
          name: newOwner.name,
          email: newOwner.email || null,
          phone: newOwner.phone || null,
          preferred_contact: 'email',
        })
        .select()
        .single();

      if (error) throw error;

      setOwners(prev => [...prev, data]);
      form.setValue('external_owner_id', data.id);
      setNewOwner({ name: '', email: '', phone: '' });
      setShowNewOwnerForm(false);
      
      toast({ title: 'Owner added successfully' });
    } catch (error: any) {
      toast({
        title: 'Error adding owner',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const generateLabel = () => {
    const make = form.getValues('make');
    const model = form.getValues('model');
    const frameNumber = form.getValues('frame_number');
    
    if (!make || !model || !frameNumber) {
      toast({
        title: 'Complete required fields',
        description: 'Make, model, and frame number are required to generate a label',
        variant: 'destructive',
      });
      return;
    }

    // Simulate label generation
    setLabelGenerated(true);
    toast({ title: 'Label generated successfully' });
  };

  const onSubmit = async (values: z.infer<typeof intakeSchema>) => {
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
      // Create the bike with intake status
      const bikeData = {
        make: values.make,
        model: values.model,
        frame_number: values.frame_number,
        external_owner_id: values.external_owner_id,
        accessories_included: values.accessories_included,
        source: values.source,
        photos,
        status: 'intake' as const,
        intake_date: new Date().toISOString(),
      };

      const { data: bike, error: bikeError } = await supabase
        .from('bikes')
        .insert(bikeData)
        .select()
        .single();

      if (bikeError) throw bikeError;

      // Create fulfilment event
      const { error: eventError } = await supabase
        .from('fulfilment_events')
        .insert({
          bike_id: bike.id,
          stage: 'intake',
          notes: `Bike intake completed. Label ${labelGenerated ? 'generated' : 'pending'}.`,
          performed_by: profile?.id,
        });

      if (eventError) throw eventError;

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

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Owner Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Owner Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="external_owner_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner *</FormLabel>
                    <div className="flex gap-2">
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select owner" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {owners.map((owner) => (
                            <SelectItem key={owner.id} value={owner.id}>
                              {owner.name} {owner.email && `(${owner.email})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowNewOwnerForm(!showNewOwnerForm)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {showNewOwnerForm && (
                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <Input
                        placeholder="Owner name *"
                        value={newOwner.name}
                        onChange={(e) => setNewOwner(prev => ({ ...prev, name: e.target.value }))}
                      />
                      <Input
                        placeholder="Email"
                        type="email"
                        value={newOwner.email}
                        onChange={(e) => setNewOwner(prev => ({ ...prev, email: e.target.value }))}
                      />
                      <Input
                        placeholder="Phone"
                        value={newOwner.phone}
                        onChange={(e) => setNewOwner(prev => ({ ...prev, phone: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <Button type="button" onClick={handleAddOwner} size="sm">
                          Add Owner
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => setShowNewOwnerForm(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="customer_consignment">Customer Consignment</SelectItem>
                        <SelectItem value="owned">Owned by Us</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Bike Details */}
          <Card>
            <CardHeader>
              <CardTitle>Bike Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="make"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Make *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Trek, Specialized" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Domane, Tarmac" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
              <CardTitle>Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <PhotoUpload
                bucket="bike-photos"
                path="intake"
                photos={photos}
                onChange={setPhotos}
                maxPhotos={10}
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