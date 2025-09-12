import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Edit, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const roles = [
  { value: 'admin', label: 'Administrator', color: 'destructive' },
  { value: 'mechanic', label: 'Mechanic', color: 'default' },
  { value: 'detailer', label: 'Detailer', color: 'secondary' },
  { value: 'accountant', label: 'Accountant', color: 'outline' },
  { value: 'owner', label: 'Bike Owner', color: 'default' }
] as const;

interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

interface EditUserDialogProps {
  user: UserProfile;
  onUserUpdated: () => void;
}

export default function EditUserDialog({ user, onUserUpdated }: EditUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    role: user.role,
    active: true
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Update the profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          role: formData.role as any,
          name: formData.name
        })
        .eq('user_id', user.user_id);

      if (profileError) throw profileError;

      // Update auth user email if changed
      if (formData.email !== user.email) {
        // Note: In production, this would require service role access
        // For now, users would need to change their email through the profile settings
        toast({
          title: "Note",
          description: "Email changes require user verification. The user should update their email in their profile.",
        });
      }

      toast({
        title: "User updated successfully",
        description: `${formData.name}'s account has been updated.`,
      });

      setOpen(false);
      onUserUpdated();
    } catch (error: any) {
      toast({
        title: "Error updating user",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    setDeactivating(true);

    try {
      // Note: In production, you'd implement proper user deactivation
      // This is a simplified version for demo purposes
      toast({
        title: "Feature Note",
        description: "User deactivation requires additional backend setup. Contact system administrator.",
      });

      setOpen(false);
    } catch (error: any) {
      toast({
        title: "Error deactivating user",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeactivating(false);
    }
  };

  const getRoleColor = (role: string) => {
    const roleConfig = roles.find(r => r.value === role);
    return roleConfig?.color || 'default';
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit User
            <Badge variant={getRoleColor(user.role) as any}>
              {roles.find(r => r.value === user.role)?.label}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Update user information, role, or account status.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Full Name</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter full name"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-email">Email Address</Label>
            <Input
              id="edit-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="Enter email address"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-role">Role</Label>
            <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label>Account Status</Label>
              <p className="text-sm text-muted-foreground">
                Active accounts can log in and access the system
              </p>
            </div>
            <Switch
              checked={formData.active}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, active: checked }))}
            />
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Account created: {new Date(user.created_at).toLocaleDateString()}</span>
            <span>ID: {user.user_id.slice(0, 8)}...</span>
          </div>

          <DialogFooter className="flex-col space-y-2">
            <div className="flex justify-end gap-2 w-full">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update User
              </Button>
            </div>
            
            <div className="w-full">
              <Button 
                type="button" 
                variant="destructive" 
                size="sm" 
                className="w-full"
                onClick={handleDeactivate}
                disabled={deactivating}
              >
                {deactivating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Deactivate Account
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}