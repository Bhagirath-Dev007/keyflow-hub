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
import { Plus, Download, Copy, Search, Ban, RotateCcw, Trash2, Monitor } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { Database } from '@/integrations/supabase/types';

type LicenseKey = Database['public']['Tables']['license_keys']['Row'];
type KeyStatus = Database['public']['Enums']['key_status'];

function generateKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  ).join('-');
}

export default function KeysPage() {
  const { user, role, profile, refreshProfile } = useAuth();
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [genPlan, setGenPlan] = useState('');
  const [genDuration, setGenDuration] = useState('30');
  const [genCount, setGenCount] = useState('1');
  const [genDeviceLimit, setGenDeviceLimit] = useState('1');
  const [genCustomKey, setGenCustomKey] = useState('');
  const [useCustomKey, setUseCustomKey] = useState(false);
  const [genAppName, setGenAppName] = useState('');
  const [appFilter, setAppFilter] = useState<string>('all');
  const { toast } = useToast();

  const fetchKeys = async () => {
    let query = supabase.from('license_keys').select('*').order('created_at', { ascending: false });
    if (role === 'reseller') query = query.eq('created_by', user!.id);
    const { data } = await query;
    if (data) setKeys(data);
  };

  useEffect(() => { if (user) fetchKeys(); }, [user, role]);

  const appNames = [...new Set(keys.map(k => (k as any).app_name).filter(Boolean))];

  const filtered = keys.filter(k => {
    const matchSearch = k.key.toLowerCase().includes(search.toLowerCase()) || k.plan_name.toLowerCase().includes(search.toLowerCase()) || ((k as any).app_name || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || k.status === statusFilter;
    const matchApp = appFilter === 'all' || (k as any).app_name === appFilter;
    return matchSearch && matchStatus && matchApp;
  });

  const calcKeyCost = (count: number, deviceLimit: number) => count * (10 + deviceLimit * 20);

  const handleGenerate = async () => {
    if (!genPlan || !genAppName.trim()) {
      toast({ title: 'Plan name and App name are required', variant: 'destructive' });
      return;
    }
    const count = useCustomKey ? 1 : (parseInt(genCount) || 1);
    const duration = parseInt(genDuration) || 30;
    const deviceLimit = parseInt(genDeviceLimit) || 1;

    if (useCustomKey && !genCustomKey.trim()) {
      toast({ title: 'Please enter a custom key', variant: 'destructive' });
      return;
    }

    if (role !== 'admin') {
      const totalCost = calcKeyCost(count, deviceLimit);
      const currentBalance = Number(profile?.wallet_balance || 0);
      if (currentBalance < totalCost) {
        toast({ title: 'Insufficient wallet balance', description: `Need ₹${totalCost}, you have ₹${currentBalance}`, variant: 'destructive' });
        return;
      }

      const newBalance = currentBalance - totalCost;
      await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('user_id', user!.id);
      await supabase.from('transactions').insert({
        user_id: user!.id,
        amount: totalCost,
        type: 'debit' as const,
        source: 'purchase' as const,
        note: `Generated ${count}x ${genPlan} key(s) (${deviceLimit} device${deviceLimit > 1 ? 's' : ''})`,
      });
      refreshProfile();
    }

    const newKeys = Array.from({ length: count }, () => ({
      key: useCustomKey ? genCustomKey.trim() : generateKey(),
      plan_name: genPlan,
      duration_days: duration,
      created_by: user!.id,
      device_limit: deviceLimit,
      app_name: genAppName.trim().toUpperCase(),
    }));

    const { error } = await supabase.from('license_keys').insert(newKeys as any);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: `${count} key(s) generated` });
    setGenerateOpen(false);
    setGenPlan(''); setGenCount('1'); setGenCustomKey(''); setUseCustomKey(false); setGenDeviceLimit('1');
    fetchKeys();
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: 'Key copied!' });
  };

  const handleDeactivate = async (id: string) => {
    await supabase.from('license_keys').update({ status: 'revoked' as KeyStatus }).eq('id', id);
    toast({ title: 'Key revoked' });
    fetchKeys();
  };

  const handleReactivate = async (k: LicenseKey) => {
    const now = new Date();
    const expiry = new Date(now.getTime() + k.duration_days * 86400000);
    await supabase.from('license_keys').update({
      status: 'active' as KeyStatus,
      activated_at: now.toISOString(),
      expires_at: expiry.toISOString(),
    }).eq('id', k.id);
    toast({ title: 'Key reactivated!' });
    fetchKeys();
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('Delete this key permanently?')) return;
    await supabase.from('license_keys').delete().eq('id', id);
    toast({ title: 'Key deleted' });
    fetchKeys();
  };

  const statusColor = (s: KeyStatus) => {
    switch (s) {
      case 'active': return 'default';
      case 'expired': return 'destructive';
      case 'revoked': return 'destructive';
      case 'unused': return 'secondary';
    }
  };

  const exportCSV = () => {
    const header = 'Key,Plan,Duration,Status,Device Limit,Devices,Created At,Expires At\n';
    const rows = filtered.map(k => {
      const devices = (k.device_ids || []).join('; ');
      return `${k.key},${k.plan_name},${k.duration_days},${k.status},${k.device_limit || 1},${devices},${k.created_at},${k.expires_at || ''}`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'license_keys.csv'; a.click();
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h1 className="page-header">License Keys</h1>
          <div className="flex flex-wrap gap-2">
            {(role === 'admin' || role === 'reseller') && (
              <Button onClick={() => setGenerateOpen(true)}><Plus className="mr-2 h-4 w-4" />Generate Keys</Button>
            )}
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-2 h-4 w-4" />CSV</Button>
          </div>
        </div>

        <div className="mb-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search keys..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="unused">Unused</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Devices</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(k => (
                <TableRow key={k.id}>
                  <TableCell className="font-mono text-sm">{k.key}</TableCell>
                  <TableCell>{k.plan_name}</TableCell>
                  <TableCell>{k.duration_days}d</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{(k.device_ids || []).length}/{k.device_limit || 1}</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant={statusColor(k.status)} className="capitalize">{k.status}</Badge></TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{k.expires_at ? new Date(k.expires_at).toLocaleDateString() : '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => copyKey(k.key)} title="Copy key"><Copy className="h-4 w-4" /></Button>
                      {(role === 'admin' || role === 'reseller') && (k.status === 'active' || k.status === 'unused') && (
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDeactivate(k.id)} title="Revoke"><Ban className="h-4 w-4" /></Button>
                      )}
                      {(role === 'admin' || role === 'reseller') && k.status === 'revoked' && (
                        <Button size="sm" variant="ghost" className="text-primary" onClick={() => handleReactivate(k)} title="Reactivate"><RotateCcw className="h-4 w-4" /></Button>
                      )}
                      {role === 'admin' && (
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDeleteKey(k.id)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No keys found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Generate Keys Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Generate License Keys</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <Label>Custom Key</Label>
              <Switch checked={useCustomKey} onCheckedChange={setUseCustomKey} />
            </div>
            {useCustomKey ? (
              <div className="space-y-2">
                <Label>Enter Custom Key</Label>
                <Input value={genCustomKey} onChange={e => setGenCustomKey(e.target.value)} placeholder="MY-CUSTOM-KEY-2025" className="font-mono" />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Count</Label>
                <Input type="number" min="1" max="100" value={genCount} onChange={e => setGenCount(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Plan Name</Label>
              <Input value={genPlan} onChange={e => setGenPlan(e.target.value)} placeholder="e.g. Premium" />
            </div>
            <div className="space-y-2">
              <Label>Duration (days)</Label>
              <Input type="number" value={genDuration} onChange={e => setGenDuration(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Device Limit</Label>
              <Select value={genDeviceLimit} onValueChange={setGenDeviceLimit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 5, 7, 10, 25, 50, 100, 500].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} device{n > 1 ? 's' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {role !== 'admin' && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-sm font-medium">
                  Cost: ₹{calcKeyCost(useCustomKey ? 1 : (parseInt(genCount) || 1), parseInt(genDeviceLimit) || 1).toLocaleString('en-IN')}
                  <span className="text-muted-foreground ml-1">(₹10/key + ₹20/device)</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">Wallet: ₹{Number(profile?.wallet_balance || 0).toLocaleString('en-IN')}</p>
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={handleGenerate}>Generate</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
