import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface AddInvestorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (investor: { user_id: string; name: string; email: string }) => void;
}

export default function AddInvestorDialog({ open, onOpenChange, onCreated }: AddInvestorDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const { toast } = useToast();

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) password += chars.charAt(Math.floor(Math.random() * chars.length));
    setFormData(prev => ({ ...prev, password }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-investor', {
        body: { name: formData.name, email: formData.email, password: formData.password },
      });
      if (error) throw error;
      if (!data?.user_id) throw new Error(data?.error ?? 'Failed to create investor');

      toast({
        title: 'Investor created',
        description: `${formData.name} has been added and can sign in to the investor portal.`,
      });
      onCreated({ user_id: data.user_id, name: formData.name, email: formData.email });
      setFormData({ name: '', email: '', password: '' });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Error creating investor', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Investor</DialogTitle>
          <DialogDescription>
            Create an investor account. They'll be able to sign in to the investor portal after verifying their email.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="investor-name">Full Name</Label>
            <Input
              id="investor-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter full name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="investor-email">Email Address</Label>
            <Input
              id="investor-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="investor@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="investor-password">Temporary Password</Label>
              <Button type="button" variant="outline" size="sm" onClick={generatePassword}>
                Generate
              </Button>
            </div>
            <Input
              id="investor-password"
              type="text"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              placeholder="Enter temporary password"
              required
              minLength={6}
            />
            <p className="text-xs text-muted-foreground">Investor should change this password on first login.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Investor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
