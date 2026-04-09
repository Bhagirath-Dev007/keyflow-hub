import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Gamepad2, Power } from 'lucide-react';

export default function ModConfigPage() {
  const { isAdminOrOwner } = useAuth();
  const [configs, setConfigs] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ app_name: '', mod_name: '', status_text: 'MOD STATUS :- ACTIVE', master_switch: true });
  const { toast } = useToast();

  const fetchConfigs = async () => {
    const { data } = await supabase.from('mod_config').select('*').order('app_name');
    if (data) setConfigs(data);
  };

  useEffect(() => { if (isAdminOrOwner) fetchConfigs(); }, [isAdminOrOwner]);

  const handleSave = async () => {
    if (!form.app_name.trim()) { toast({ title: 'App name required', variant: 'destructive' }); return; }
    const payload = {
      app_name: form.app_name.trim().toUpperCase(),
      mod_name: form.mod_name,
      status_text: form.status_text,
      master_switch: form.master_switch,
    };
    if (editId) {
      await supabase.from('mod_config').update(payload).eq('id', editId);
      toast({ title: 'Config updated!' });
    } else {
      const { error } = await supabase.from('mod_config').insert(payload);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Config created!' });
    }
    setDialogOpen(false);
    setEditId(null);
    setForm({ app_name: '', mod_name: '', status_text: 'MOD STATUS :- ACTIVE', master_switch: true });
    fetchConfigs();
  };

  const openEdit = (c: any) => {
    setForm({ app_name: c.app_name, mod_name: c.mod_name, status_text: c.status_text, master_switch: c.master_switch });
    setEditId(c.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this config?')) return;
    await supabase.from('mod_config').delete().eq('id', id);
    toast({ title: 'Config deleted' });
    fetchConfigs();
  };

  const toggleMasterSwitch = async (id: string, current: boolean) => {
    await supabase.from('mod_config').update({ master_switch: !current }).eq('id', id);
    fetchConfigs();
  };

  if (!isAdminOrOwner) return <DashboardLayout><p>Access denied</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h1 className="page-header flex items-center gap-2"><Gamepad2 className="h-6 w-6" />Mod Configuration</h1>
          <Button onClick={() => { setEditId(null); setForm({ app_name: '', mod_name: '', status_text: 'MOD STATUS :- ACTIVE', master_switch: true }); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />Add App Config
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {configs.map(c => (
            <Card key={c.id} className="stat-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{c.app_name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Power className={`h-4 w-4 ${c.master_switch ? 'text-success' : 'text-destructive'}`} />
                  <Switch checked={c.master_switch} onCheckedChange={() => toggleMasterSwitch(c.id, c.master_switch)} />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm"><span className="text-muted-foreground">Mod Name:</span> {c.mod_name || '—'}</p>
                <p className="text-sm"><span className="text-muted-foreground">Status:</span> {c.status_text}</p>
                <Badge variant={c.master_switch ? 'default' : 'destructive'}>{c.master_switch ? 'ONLINE' : 'OFFLINE'}</Badge>
                <div className="flex gap-1 pt-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(c)}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {configs.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-12">No mod configurations yet. Add one for each app.</div>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Edit' : 'Add'} Mod Config</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>App Name</Label>
              <Input value={form.app_name} onChange={e => setForm({ ...form, app_name: e.target.value })} placeholder="e.g. MARS LOADER" className="uppercase" disabled={!!editId} />
            </div>
            <div className="space-y-2">
              <Label>Mod Display Name</Label>
              <Input value={form.mod_name} onChange={e => setForm({ ...form, mod_name: e.target.value })} placeholder="e.g. Mars Mod v2.0" />
            </div>
            <div className="space-y-2">
              <Label>Status Text</Label>
              <Input value={form.status_text} onChange={e => setForm({ ...form, status_text: e.target.value })} placeholder="MOD STATUS :- 100% SAFE" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Master Switch (Online/Offline)</Label>
              <Switch checked={form.master_switch} onCheckedChange={v => setForm({ ...form, master_switch: v })} />
            </div>
          </div>
          <DialogFooter><Button onClick={handleSave}>{editId ? 'Update' : 'Create'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
