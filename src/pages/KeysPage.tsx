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
import { Plus, Download, Copy, Search, Ban, RotateCcw, Trash2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type LicenseKey = Database['public']['Tables']['license_keys']['Row'];
type KeyStatus = Database['public']['Enums']['key_status'];

function generateKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  );
  return segments.join('-');
}

export default function KeysPage() {
  const { user, role } = useAuth();
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [genPlan, setGenPlan] = useState('');
  const [genDuration, setGenDuration] = useState('30');
  const [genCount, setGenCount] = useState('1');
  const [activateOpen, setActivateOpen] = useState(false);
  const [activateKey, setActivateKey] = useState('');
  const { toast } = useToast();

  const fetchKeys = async () => {
    let query = supabase.from('license_keys').select('*').order('created_at', { ascending: false });
    if (role === 'user') query = query.eq('assigned_to', user!.id);
    if (role === 'reseller') query = query.eq('created_by', user!.id);
    const { data } = await query;
    if (data) setKeys(data);
  };

  useEffect(() => { if (user) fetchKeys(); }, [user, role]);

  const filtered = keys.filter(k => {
    const matchSearch = k.key.toLowerCase().includes(search.toLowerCase()) || k.plan_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || k.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleGenerate = async () => {
    if (!genPlan) return;
    const count = parseInt(genCount) || 1;
    const duration = parseInt(genDuration) || 30;
    const newKeys = Array.from({ length: count }, () => ({
      key: generateKey(),
      plan_name: genPlan,
      duration_days: duration,
      created_by: user!.id,
    }));
    const { error } = await supabase.from('license_keys').insert(newKeys);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `${count} key(s) generated` });
    setGenerateOpen(false);
    setGenPlan(''); setGenCount('1');
    fetchKeys();
  };

  const handleActivateKey = async () => {
    if (!activateKey.trim()) return;
    const { data: keyData, error: findErr } = await supabase
      .from('license_keys').select('*').eq('key', activateKey.trim()).eq('status', 'unused').single();
    if (findErr || !keyData) {
      toast({ title: 'Key not found or already used', variant: 'destructive' }); return;
    }
    const now = new Date();
    const expiry = new Date(now.getTime() + keyData.duration_days * 86400000);
    const { error } = await supabase.from('license_keys').update({
      status: 'active' as KeyStatus,
      assigned_to: user!.id,
      activated_at: now.toISOString(),
      expires_at: expiry.toISOString(),
    }).eq('id', keyData.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Key activated!' });
    setActivateOpen(false); setActivateKey('');
    fetchKeys();
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setActivateKey(text.trim());
    } catch {
      toast({ title: 'Could not read clipboard', variant: 'destructive' });
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: 'Key copied!' });
  };

  const handleDeactivate = async (id: string) => {
    const { error } = await supabase.from('license_keys').update({ status: 'revoked' as KeyStatus }).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Key revoked successfully' });
    fetchKeys();
  };

  const handleReactivate = async (k: LicenseKey) => {
    const now = new Date();
    const expiry = new Date(now.getTime() + k.duration_days * 86400000);
    const { error } = await supabase.from('license_keys').update({
      status: 'active' as KeyStatus,
      activated_at: now.toISOString(),
      expires_at: expiry.toISOString(),
    }).eq('id', k.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Key reactivated!' });
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
    const header = 'Key,Plan,Duration,Status,Device ID,Created At,Expires At\n';
    const rows = filtered.map(k => `${k.key},${k.plan_name},${k.duration_days},${k.status},${k.device_id || ''},${k.created_at},${k.expires_at || ''}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'license_keys.csv'; a.click();
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="page-header">License Keys</h1>
          <div className="flex gap-2">
            {role === 'user' && (
              <Button onClick={() => setActivateOpen(true)}><Plus className="mr-2 h-4 w-4" />Activate Key</Button>
            )}
            {(role === 'admin' || role === 'reseller') && (
              <Button onClick={() => setGenerateOpen(true)}><Plus className="mr-2 h-4 w-4" />Generate Keys</Button>
            )}
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-2 h-4 w-4" />CSV</Button>
          </div>
        </div>

        <div className="mb-4 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search keys..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="unused">Unused</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Duration</TableHead>
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
                  <TableCell><Badge variant={statusColor(k.status)} className="capitalize">{k.status}</Badge></TableCell>
                  <TableCell className="text-sm">{k.expires_at ? new Date(k.expires_at).toLocaleDateString() : '—'}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => copyKey(k.key)} title="Copy key"><Copy className="h-4 w-4" /></Button>
                    {(role === 'admin' || role === 'reseller') && (k.status === 'active' || k.status === 'unused') && (
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDeactivate(k.id)} title="Revoke key"><Ban className="h-4 w-4" /></Button>
                    )}
                    {(role === 'admin' || role === 'reseller') && k.status === 'revoked' && (
                      <Button size="sm" variant="ghost" className="text-primary" onClick={() => handleReactivate(k)} title="Reactivate key"><RotateCcw className="h-4 w-4" /></Button>
                    )}
                    {role === 'admin' && (
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDeleteKey(k.id)} title="Delete key"><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No keys found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Generate Keys Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate License Keys</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Plan Name</Label><Input value={genPlan} onChange={e => setGenPlan(e.target.value)} placeholder="e.g. Premium" /></div>
            <div className="space-y-2"><Label>Duration (days)</Label><Input type="number" value={genDuration} onChange={e => setGenDuration(e.target.value)} /></div>
            <div className="space-y-2"><Label>Count</Label><Input type="number" min="1" max="100" value={genCount} onChange={e => setGenCount(e.target.value)} /></div>
          </div>
          <DialogFooter><Button onClick={handleGenerate}>Generate</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate Key Dialog */}
      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Activate License Key</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>License Key</Label>
              <div className="flex gap-2">
                <Input value={activateKey} onChange={e => setActivateKey(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" className="font-mono" />
                <Button variant="outline" onClick={handlePasteFromClipboard}>Paste</Button>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleActivateKey}>Activate</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
