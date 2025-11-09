import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import PhotoUpload from '@/components/PhotoUpload';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const bikeSchema = z.object({
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  year: z.number().optional(),
  size: z.string().optional(),
  colour: z.string().optional(),
  condition: z.string().optional(),
  accessories_included: z.string().optional(),
  source: z.enum(['owned', 'customer_consignment']),
  
  purchase_price: z.number().optional(),
  asking_price: z.number().optional(),
  finance_scheme: z.enum(['vat_qualifying', 'margin_scheme', 'commercial_vat']),
  description: z.string().optional(),
  listing_description: z.string().optional(),

  // Collection fields
  arrange_collection: z.boolean().default(false),
  collection_sender_name: z.string().optional(),
  collection_sender_email: z.string().email().optional().or(z.literal('')),
  collection_sender_phone: z.string().optional(),
  collection_address_street: z.string().optional(),
  collection_address_city: z.string().optional(),
  collection_address_postcode: z.string().optional(),
  collection_instructions: z.string().optional(),
}).refine(
  (data) => {
    if (data.arrange_collection) {
      return (
        data.collection_sender_name &&
        data.collection_sender_email &&
        data.collection_sender_phone &&
        data.collection_address_street &&
        data.collection_address_city &&
        data.collection_address_postcode
      );
    }
    return true;
  },
  {
    message: 'All collection details are required when arranging collection',
    path: ['arrange_collection']
  }
);

interface BikeFormProps {
  bike?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function BikeForm({ bike, onSuccess, onCancel }: BikeFormProps) {
  const [photos, setPhotos] = useState<string[]>(bike?.photos || []);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<z.infer<typeof bikeSchema>>({
    resolver: zodResolver(bikeSchema),
    defaultValues: {
      make: bike?.make || '',
      model: bike?.model || '',
      year: bike?.year || undefined,
      size: bike?.size || '',
      colour: bike?.colour || '',
      condition: bike?.condition || '',
      accessories_included: bike?.accessories_included || '',
      source: bike?.source || 'owned',
      
      purchase_price: bike?.purchase_price || undefined,
      asking_price: bike?.asking_price || undefined,
      finance_scheme: bike?.finance_scheme || 'margin_scheme',
      description: bike?.description || '',
      listing_description: bike?.listing_description || '',

      arrange_collection: false,
      collection_sender_name: '',
      collection_sender_email: '',
      collection_sender_phone: '',
      collection_address_street: '',
      collection_address_city: '',
      collection_address_postcode: '',
      collection_instructions: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof bikeSchema>) => {
    setSubmitting(true);
    try {
      const { arrange_collection, collection_sender_name, collection_sender_email, 
              collection_sender_phone, collection_address_street, collection_address_city,
              collection_address_postcode, collection_instructions, ...bikeFields } = values;

      const bikeData = {
        ...bikeFields,
        fulfillment_type: 'stocked_by_me',
        status: arrange_collection ? 'awaiting_collection' : 'pending_intake',
        photos,
      };

      let bikeId = bike?.id;

      if (bike) {
        const { error } = await supabase
          .from('bikes')
          .update(bikeData as any)
          .eq('id', bike.id);
        if (error) throw error;
        toast({ title: 'Bike updated successfully' });
      } else {
        const { data, error } = await supabase
          .from('bikes')
          .insert(bikeData as any)
          .select('id')
          .single();
        if (error) throw error;
        bikeId = data.id;
        toast({ title: 'Bike created successfully' });
      }

      // Arrange collection if requested
      if (arrange_collection && bikeId) {
        const { data: collectionData, error: collectionError } = await supabase.functions.invoke('create-collection-order', {
          body: {
            bike_id: bikeId,
            sender_name: collection_sender_name,
            sender_email: collection_sender_email,
            sender_phone: collection_sender_phone,
            address_street: collection_address_street,
            address_city: collection_address_city,
            address_postcode: collection_address_postcode,
            delivery_instructions: collection_instructions
          }
        });

        if (collectionError) {
          toast({
            title: 'Collection booking failed',
            description: 'Bike saved but collection not arranged. You can retry from bike details.',
            variant: 'destructive'
          });
        } else {
          toast({
            title: 'Collection arranged',
            description: collectionData.tracking_number ? `Tracking: ${collectionData.tracking_number}` : 'Collection order created successfully'
          });
        }
      }
      
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

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="2023" 
                          value={field.value ?? ''}
                          onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Size</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Medium, 54cm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="colour"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Colour</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Blue, Black" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="condition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condition</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="as_new">As New</SelectItem>
                        <SelectItem value="excellent">Excellent</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                      </SelectContent>
                    </Select>
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

              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="owned">Owned by us</SelectItem>
                        <SelectItem value="customer_consignment">Customer consignment</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing & Finance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="purchase_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Price</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00" 
                          value={field.value ?? ''}
                          onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormDescription>Cost to acquire the bike</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="asking_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asking Price</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00" 
                          value={field.value ?? ''}
                          onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormDescription>Listed sale price</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="finance_scheme"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>VAT Scheme</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select VAT scheme" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="margin_scheme">Margin Scheme</SelectItem>
                        <SelectItem value="vat_qualifying">VAT Qualifying</SelectItem>
                        <SelectItem value="commercial_vat">Commercial VAT</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bike Collection (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="arrange_collection"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Arrange bike collection via Cycle Courier Co
                      </FormLabel>
                      <FormDescription>
                        We'll automatically book collection from the owner's address
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {form.watch('arrange_collection') && (
                <div className="space-y-4 pl-6 border-l-2 border-muted">
                  <h4 className="text-sm font-medium">Sender Details</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="collection_sender_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sender Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="John Smith" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="collection_sender_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone *</FormLabel>
                          <FormControl>
                            <Input placeholder="+44 7700 900000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="collection_sender_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <h4 className="text-sm font-medium pt-2">Pickup Address</h4>

                  <FormField
                    control={form.control}
                    name="collection_address_street"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address *</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main Street" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="collection_address_city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City *</FormLabel>
                          <FormControl>
                            <Input placeholder="Brighton" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="collection_address_postcode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postcode *</FormLabel>
                          <FormControl>
                            <Input placeholder="BN1 1AA" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="collection_instructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Instructions</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Any special instructions for the courier..."
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Descriptions & Photos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Internal notes about the bike..."
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="listing_description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Listing Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Public description for listings..."
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>This will be shown to customers</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <FormLabel>Photos</FormLabel>
                <PhotoUpload
                  bucket="bike-photos"
                  path={`bike-${bike?.id || 'new'}`}
                  photos={photos}
                  onChange={setPhotos}
                  maxPhotos={10}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : bike ? 'Update Bike' : 'Create Bike'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}