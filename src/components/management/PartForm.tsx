import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const partSchema = z.object({
  type: z.enum(['secondhand_bought', 'secondhand_stripped', 'new_resale', 'new_fitted']),
  brand: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  part_number: z.string().optional(),
  cost_price: z.number().optional(),
  sale_price: z.number().optional(),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  stock_status: z.enum(['in_stock', 'reserved', 'sold', 'damaged']),
  bike_id: z.string().optional(),
  stripped_from_bike_id: z.string().optional(),
});

interface PartFormProps {
  part?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PartForm({ part, onSuccess, onCancel }: PartFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [bikes, setBikes] = useState<Array<{ id: string; make: string; model: string }>>([]);

  const form = useForm<z.infer<typeof partSchema>>({
    resolver: zodResolver(partSchema),
    defaultValues: {
      type: part?.type || 'new_resale',
      brand: part?.brand || '',
      description: part?.description || '',
      part_number: part?.part_number || '',
      cost_price: part?.cost_price || undefined,
      sale_price: part?.sale_price || undefined,
      quantity: part?.quantity || 1,
      stock_status: part?.stock_status || 'in_stock',
      bike_id: part?.bike_id || '',
      stripped_from_bike_id: part?.stripped_from_bike_id || '',
    },
  });

  useEffect(() => {
    loadBikes();
  }, []);

  const loadBikes = async () => {
    try {
      const { data, error } = await supabase
        .from('bikes')
        .select('id, make, model')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBikes(data || []);
    } catch (error: any) {
      console.error('Error loading bikes:', error);
    }
  };

  const selectedType = form.watch('type');

  const onSubmit = async (values: z.infer<typeof partSchema>) => {
    setSubmitting(true);
    try {
      if (part) {
        const { error } = await supabase
          .from('parts')
          .update(values)
          .eq('id', part.id);
        if (error) throw error;
        toast({ title: 'Part updated successfully' });
      } else {
        const { error } = await supabase
          .from('parts')
          .insert(values as any);
        if (error) throw error;
        toast({ title: 'Part created successfully' });
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
              <CardTitle>Part Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select part type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="secondhand_bought">Secondhand (bought)</SelectItem>
                          <SelectItem value="secondhand_stripped">Secondhand (stripped from bike)</SelectItem>
                          <SelectItem value="new_resale">New (for resale)</SelectItem>
                          <SelectItem value="new_fitted">New (to fit on bike)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stock_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="in_stock">In Stock</SelectItem>
                          <SelectItem value="reserved">Reserved</SelectItem>
                          <SelectItem value="sold">Sold</SelectItem>
                          <SelectItem value="damaged">Damaged</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Shimano, SRAM" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="part_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Part Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Manufacturer part number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe the part..."
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1"
                          {...field} 
                          onChange={e => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cost_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost Price</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00"
                          {...field} 
                          onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sale_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sale Price</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00"
                          {...field} 
                          onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {selectedType === 'secondhand_stripped' && (
                <FormField
                  control={form.control}
                  name="stripped_from_bike_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stripped from Bike</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select bike" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {bikes.map((bike) => (
                            <SelectItem key={bike.id} value={bike.id}>
                              {bike.make} {bike.model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Which bike was this part removed from?</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {(selectedType === 'new_fitted') && (
                <FormField
                  control={form.control}
                  name="bike_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bike to Fit</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select bike" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {bikes.map((bike) => (
                            <SelectItem key={bike.id} value={bike.id}>
                              {bike.make} {bike.model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Which bike will this part be fitted to?</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : part ? 'Update Part' : 'Create Part'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}