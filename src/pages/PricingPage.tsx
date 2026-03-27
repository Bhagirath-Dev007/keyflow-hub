import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Pricing = Database['public']['Tables']['pricing']['Row'];

export default function PricingPage() {
  const { role } = useAuth();
  const [plans, setPlans] = useState<Pricing[]>([]);
  const [dialog, setDialog] = useState<{ open: boolean; plan: Pricing | null }>({ open: false, plan: null });
  const [form, setForm] = useState({ plan_name: '', duration_days: '30', user_price: '', reseller_price: '' });
  const { toast } = useToast();

  const fetchPlans = async () => {
    const { data } = await supabase.from('pricing').select('*').order('created_at');
    if (data) setPlans(data);
  };

  useEffect(() => { fetchPlans(); }, []);

  const openCreate = () => {
    setForm({ plan_name: '', duration_days: '30', user_price: '', reseller_price: '' });
    setDialog({ open: true, plan: null });
  };

  const openEdit = (p: Pricing) => {
    setForm({ plan_name: p.plan_name, duration_days: String(p.duration_days), user_price: String(p.user_price), reseller_price: String(p.reseller_price) });
    setDialog({ open: true, plan: p });
  };

  const handleSave = async () => {
    const payload = {
      plan_name: form.plan_name,
      duration_days: parseInt(form.duration_days),
      user_price: parseFloat(form.user_price),
      reseller_price: parseFloat(form.reseller_price),
    };
    if (dialog.plan) {
      await supabase.from('pricing').update(payload).eq('id', dialog.plan.id);
    } else {
      await supabase.from('pricing').insert(payload);
    }
    toast({ title: dialog.plan ? 'Plan updated' : 'Plan created' });
    setDialog({ open: false, plan: null });
    fetchPlans();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('pricing').delete().eq('id', id);
    toast({ title: 'Plan deleted' });
    fetchPlans();
  };

  if (role !== 'admin') return <DashboardLayout><p>Access denied</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="page-header">Pricing Plans</h1>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Plan</Button>
        </div>

        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan Name</TableHead>
                <TableHead>Duration (days)</TableHead>
                <TableHead>User Price (₹)</TableHead>
                <TableHead>Reseller Price (₹)</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.plan_name}</TableCell>
                  <TableCell>{p.duration_days}</TableCell>
                  <TableCell className="font-mono">₹{Number(p.user_price).toLocaleString('en-IN')}</TableCell>
                  <TableCell className="font-mono">₹{Number(p.reseller_price).toLocaleString('en-IN')}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {plans.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No plans yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialog.open} onOpenChange={open => !open && setDialog({ open: false, plan: null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dialog.plan ? 'Edit Plan' : 'Create Plan'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Plan Name</Label><Input value={form.plan_name} onChange={e => setForm({ ...form, plan_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Duration (days)</Label><Input type="number" value={form.duration_days} onChange={e => setForm({ ...form, duration_days: e.target.value })} /></div>
            <div className="space-y-2"><Label>User Price (₹)</Label><Input type="number" value={form.user_price} onChange={e => setForm({ ...form, user_price: e.target.value })} /></div>
            <div className="space-y-2"><Label>Reseller Price (₹)</Label><Input type="number" value={form.reseller_price} onChange={e => setForm({ ...form, reseller_price: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleSave}>{dialog.plan ? 'Update' : 'Create'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
