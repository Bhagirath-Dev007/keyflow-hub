import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Copy, Gift } from 'lucide-react';

export default function ReferralCodesPage() {
  const { user, isAdminOrOwner, isOwner } = useAuth();
  const [codes, setCodes] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ code: '', level: 'reseller', bonus_balance: '0', expiration_days: '30', max_uses: '1' });
  const { toast } = useToast();

  const fetchCodes = async () => {
    const { data } = await supabase.from('referral_codes').select('*').order('created_at', { ascending: false });
    if (data) setCodes(data);
  };

  useEffect(() => { if (isAdminOrOwner) fetchCodes(); }, [isAdminOrOwner]);

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return 'REF-' + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const handleCreate = async () => {
    if (!form.code.trim()) { toast({ title: 'Code is required', variant: 'destructive' }); return; }
    const { error } = await supabase.from('referral_codes').insert({
      code: form.code.trim().toUpperCase(),
      level: form.level as any,
      bonus_balance: parseFloat(form.bonus_balance) || 0,
      expiration_days: parseInt(form.expiration_days) || 30,
      max_uses: parseInt(form.max_uses) || 1,
      created_by: user!.id,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Referral code created!' });
    setDialogOpen(false);
    setForm({ code: '', level: 'reseller', bonus_balance: '0', expiration_days: '30', max_uses: '1' });
    fetchCodes();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this referral code?')) return;
    await supabase.from('referral_codes').delete().eq('id', id);
    toast({ title: 'Code deleted' });
    fetchCodes();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: 'Code copied!' });
  };

  if (!isAdminOrOwner) return <DashboardLayout><p>Access denied</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h1 className="page-header">Referral Codes</h1>
          <Button onClick={() => { setForm({ ...form, code: generateCode() }); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />Create Code
          </Button>
        </div>

        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Bonus (₹)</TableHead>
                <TableHead>Expiry (days)</TableHead>
                <TableHead>Uses</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono font-semibold">{c.code}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{c.level}</Badge></TableCell>
                  <TableCell className="font-mono">₹{Number(c.bonus_balance).toLocaleString('en-IN')}</TableCell>
                  <TableCell>{c.expiration_days}d</TableCell>
                  <TableCell>{c.current_uses}/{c.max_uses}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => copyCode(c.code)} title="Copy"><Copy className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(c.id)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {codes.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No referral codes yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Referral Code</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Code</Label>
              <div className="flex gap-2">
                <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="REF-XXXXXXXX" className="font-mono uppercase" />
                <Button variant="outline" size="sm" onClick={() => setForm({ ...form, code: generateCode() })}>
                  <Gift className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Account Level</Label>
              <Select value={form.level} onValueChange={v => setForm({ ...form, level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reseller">Reseller</SelectItem>
                  {isOwner && <SelectItem value="admin">Admin</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bonus Balance (₹)</Label>
              <Input type="number" value={form.bonus_balance} onChange={e => setForm({ ...form, bonus_balance: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Account Expiration (days)</Label>
              <Input type="number" value={form.expiration_days} onChange={e => setForm({ ...form, expiration_days: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Max Uses</Label>
              <Input type="number" min="1" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: e.target.value })} />
            </div>
          </div>
          <DialogFooter><Button onClick={handleCreate}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
