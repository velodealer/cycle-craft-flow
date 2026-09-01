import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PhotoUpload from '@/components/PhotoUpload';
import { tryPostPurchase } from '@/lib/quickbooks';
import OwnerForm from '@/components/management/OwnerForm';
import AddInvestorDialog from '@/components/management/AddInvestorDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useStorageBays } from '@/hooks/useStorageBays';
import LocationSelect from '@/components/bike/LocationSelect';
import BikeCatalogLookup from '@/components/management/BikeCatalogLookup';
import { saveCatalogBike, upsertComponentsForBike, type MappedBike } from '@/lib/spokes';




const bikeSchema = z.object({
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  year: z.number().optional(),
  size: z.string().optional(),
  colour: z.string().optional(),
  storage_bay_id: z.string().optional(),
  condition: z.string().optional(),
  frame_number: z.string().optional(),
  accessories_included: z.string().optional(),
  source: z.enum(['owned', 'customer_consignment', 'investor']),
  external_owner_id: z.string().uuid().optional(),
  investor_id: z.string().uuid().optional(),
  profit_share_pct: z.number().min(0).max(100).optional(),
  purchase_cost: z.number().optional(),
  
  purchase_price: z.number().optional(),
  asking_price: z.number().optional(),
  collection_cost: z.number().optional(),
  delivery_cost: z.number().optional(),
  purchase_date: z.date().optional(),
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
).refine(
  (data) => data.source !== 'customer_consignment' || !!data.external_owner_id,
  {
    message: 'Please select an owner for a customer consignment bike',
    path: ['external_owner_id'],
  }
).refine(
  (data) => data.source !== 'investor' || !!data.investor_id,
  {
    message: 'Please select an investor for an investor bike',
    path: ['investor_id'],
  }
).refine(
  (data) => data.source !== 'investor' || (data.profit_share_pct !== undefined && data.profit_share_pct >= 0 && data.profit_share_pct <= 100),
  {
    message: 'Profit share % is required for investor bikes (0-100)',
    path: ['profit_share_pct'],
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
  const { bays: storageBays } = useStorageBays();
  const [owners, setOwners] = useState<Array<{ id: string; name: string; email: string | null; phone: string | null; address: string | null }>>([]);
  const [investors, setInvestors] = useState<Array<{ user_id: string; name: string; email: string }>>([]);
  const [showOwnerDialog, setShowOwnerDialog] = useState(false);
  const [showInvestorDialog, setShowInvestorDialog] = useState(false);
  const [spokesFill, setSpokesFill] = useState<{ raw: any; mapped: MappedBike; size: string | null } | null>(null);
  const { profile } = useAuth();
  const isMechanic = profile?.role === 'mechanic';


  const loadOwners = async () => {
    const { data, error } = await supabase
      .from('external_owners')
      .select('id, name, email, phone, address')
      .order('name');
    if (!error && data) setOwners(data as any);
  };

  const loadInvestors = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, name, email')
      .eq('role', 'investor' as any)
      .order('name');
    if (!error && data) setInvestors(data as any);
  };

  useEffect(() => {
    loadOwners();
    loadInvestors();
  }, []);

  const form = useForm<z.infer<typeof bikeSchema>>({
    resolver: zodResolver(bikeSchema),
    defaultValues: {
      make: bike?.make || '',
      model: bike?.model || '',

      year: bike?.year || undefined,
      size: bike?.size || '',
      colour: bike?.colour || '',
      storage_bay_id: bike?.storage_bay_id || '',
      condition: bike?.condition || '',
      frame_number: bike?.frame_number || '',
      accessories_included: bike?.accessories_included || '',
      source: bike?.source || 'owned',
      external_owner_id: bike?.external_owner_id || undefined,
      investor_id: bike?.investor_id || undefined,
      profit_share_pct: bike?.profit_share_pct ?? undefined,
      purchase_cost: bike?.purchase_cost ?? undefined,
      
      purchase_price: bike?.purchase_price || undefined,
      asking_price: bike?.asking_price || undefined,
      collection_cost: bike?.collection_cost ?? undefined,
      delivery_cost: bike?.delivery_cost ?? undefined,
      purchase_date: bike?.purchase_date ? new Date(bike.purchase_date) : undefined,
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
              collection_address_postcode, collection_instructions, purchase_date, ...bikeFields } = values;

      // Spec/flags pulled from a 99spokes lookup (make/model/size/year already
      // live in the form fields, so they are stripped out here).
      const spokesExtras: Record<string, any> = {};
      if (spokesFill) {
        const { make, model, year, size, ...rest } = spokesFill.mapped.bikeFields;
        Object.assign(spokesExtras, rest);
        spokesExtras.spec_values = {
          ...(bike?.spec_values || {}),
          ...spokesFill.mapped.specValues,
        };
      }

      const bikeData = {
        ...bikeFields,
        ...spokesExtras,
        external_owner_id: bikeFields.source === 'customer_consignment' ? bikeFields.external_owner_id : null,
        investor_id: bikeFields.source === 'investor' ? bikeFields.investor_id : null,
        profit_share_pct: bikeFields.source === 'investor' ? bikeFields.profit_share_pct : null,
        purchase_cost: bikeFields.source === 'investor' ? bikeFields.purchase_cost : (bikeFields as any).purchase_cost ?? null,
        purchase_date: purchase_date ? purchase_date.toISOString() : null,
        fulfillment_type: 'stocked_by_me',
        status: arrange_collection ? 'awaiting_collection' : 'pending_intake',
        storage_bay_id: bikeFields.storage_bay_id || null,
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

        // Post the purchase to QuickBooks stock (purchase price only).
        const posted = await tryPostPurchase(bikeId);
        if (!posted.ok) {
          toast({
            title: 'QuickBooks purchase not posted',
            description: posted.error,
            variant: 'destructive',
          });
        }
      }

      // Grow our own catalogue + components library from the 99spokes record.
      if (spokesFill && bikeId) {
        try {
          await saveCatalogBike(spokesFill.raw, spokesFill.mapped);
          const linked = await upsertComponentsForBike(bikeId, spokesFill.mapped.components);
          if (linked > 0) {
            toast({ title: `${linked} components added to the bike` });
          }
        } catch (e: any) {
          toast({ title: 'Spec saved, components not linked', description: e.message, variant: 'destructive' });
        }
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
              <BikeCatalogLookup
                onApply={({ make, model, size, summary }) => {
                  const existing = [form.getValues('make'), form.getValues('model'), form.getValues('size')].filter(
                    (v) => v && String(v).trim(),
                  );
                  if (existing.length > 0 && !window.confirm('Overwrite the make, model and size already entered?')) {
                    return;
                  }
                  form.setValue('make', make, { shouldDirty: true, shouldValidate: true });
                  form.setValue('model', model, { shouldDirty: true, shouldValidate: true });
                  if (size) form.setValue('size', size, { shouldDirty: true });
                  if (summary && !form.getValues('description')?.trim()) {
                    form.setValue('description', summary, { shouldDirty: true });
                  }
                  toast({ title: 'Bike details filled from catalog' });
                }}
              />

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
                name="storage_bay_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Storage location</FormLabel>
                    <FormControl>
                      <LocationSelect
                        value={field.value || null}
                        onChange={(bayId) => field.onChange(bayId ?? '')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />


              <FormField
                control={form.control}
                name="frame_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frame Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., WTU123456789" {...field} />
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
                        <SelectItem value="investor">Investor bike</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch('source') === 'customer_consignment' && (
                <FormField
                  control={form.control}
                  name="external_owner_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Owner *</FormLabel>
                      <div className="flex gap-2">
                        <Select
                          onValueChange={(val) => {
                            field.onChange(val);
                            const o = owners.find((x) => x.id === val);
                            if (o && form.getValues('arrange_collection')) {
                              if (!form.getValues('collection_sender_name')) form.setValue('collection_sender_name', o.name);
                              if (!form.getValues('collection_sender_email') && o.email) form.setValue('collection_sender_email', o.email);
                              if (!form.getValues('collection_sender_phone') && o.phone) form.setValue('collection_sender_phone', o.phone);
                            }
                          }}
                          value={field.value || ''}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={owners.length ? 'Select owner' : 'No owners yet — add one'} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {owners.map((o) => (
                              <SelectItem key={o.id} value={o.id}>
                                {o.name}{o.email ? ` — ${o.email}` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="icon" onClick={() => setShowOwnerDialog(true)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <FormDescription>Customer who owns this consigned bike</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {form.watch('source') === 'investor' && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <FormField
                    control={form.control}
                    name="investor_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Investor *</FormLabel>
                        <div className="flex gap-2">
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={investors.length ? 'Select investor' : 'No investors yet — add one'} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {investors.map((i) => (
                                <SelectItem key={i.user_id} value={i.user_id}>
                                  {i.name} — {i.email}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button type="button" variant="outline" size="icon" onClick={() => setShowInvestorDialog(true)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <FormDescription>Investor who funded this bike</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {!isMechanic && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="profit_share_pct"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Profit share % *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              placeholder="50"
                              value={field.value ?? ''}
                              onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormDescription>Investor's share of net profit (0–100)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="purchase_cost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Purchase cost</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={field.value ?? ''}
                              onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormDescription>Investor's cost basis for net profit calc</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {!isMechanic && (
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="collection_cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Collection Cost</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={field.value ?? ''}
                          onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormDescription>Cost to collect the bike (inbound shipping)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="delivery_cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delivery Cost</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={field.value ?? ''}
                          onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormDescription>Cost to deliver to buyer (outbound shipping)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="purchase_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Purchase Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-[240px] pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date > new Date()}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>When the bike was acquired (optional, for retrospective entries)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />


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
          )}

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

      <Dialog open={showOwnerDialog} onOpenChange={setShowOwnerDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Owner</DialogTitle>
          </DialogHeader>
          <OwnerForm
            onSuccess={async () => {
              setShowOwnerDialog(false);
              const { data } = await supabase
                .from('external_owners')
                .select('id, name, email, phone, address')
                .order('created_at', { ascending: false })
                .limit(1);
              await loadOwners();
              if (data && data[0]) {
                form.setValue('external_owner_id', data[0].id, { shouldValidate: true });
              }
            }}
            onCancel={() => setShowOwnerDialog(false)}
          />
        </DialogContent>
      </Dialog>

      <AddInvestorDialog
        open={showInvestorDialog}
        onOpenChange={setShowInvestorDialog}
        onCreated={async (inv) => {
          await loadInvestors();
          form.setValue('investor_id', inv.user_id, { shouldValidate: true });
        }}
      />
    </div>
  );
}