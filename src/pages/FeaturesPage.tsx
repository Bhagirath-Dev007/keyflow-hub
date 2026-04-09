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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, ToggleLeft } from 'lucide-react';

export default function FeaturesPage() {
  const { isAdminOrOwner } = useAuth();
  const [features, setFeatures] = useState<any[]>([]);
  const [appFilter, setAppFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', app_name: '', enabled: true });
  const { toast } = useToast();

  const fetchFeatures = async () => {
    const { data } = await supabase.from('features').select('*').order('app_name').order('name');
    if (data) setFeatures(data);
  };

  useEffect(() => { if (isAdminOrOwner) fetchFeatures(); }, [isAdminOrOwner]);

  const appNames = [...new Set(features.map(f => f.app_name))];

  const filtered = appFilter === 'all' ? features : features.filter(f => f.app_name === appFilter);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.app_name.trim()) {
      toast({ title: 'Name and App Name required', variant: 'destructive' }); return;
    }
    const { error } = await supabase.from('features').insert({
      name: form.name.trim(),
      app_name: form.app_name.trim().toUpperCase(),
      enabled: form.enabled,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Feature created!' });
    setDialogOpen(false);
    setForm({ name: '', app_name: '', enabled: true });
    fetchFeatures();
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await supabase.from('features').update({ enabled: !enabled }).eq('id', id);
    fetchFeatures();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this feature?')) return;
    await supabase.from('features').delete().eq('id', id);
    toast({ title: 'Feature deleted' });
    fetchFeatures();
  };

  if (!isAdminOrOwner) return <DashboardLayout><p>Access denied</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h1 className="page-header flex items-center gap-2"><ToggleLeft className="h-6 w-6" />Feature Toggles</h1>
          <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Add Feature</Button>
        </div>

        {appNames.length > 0 && (
          <div className="mb-4">
            <Select value={appFilter} onValueChange={setAppFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Filter by app" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Apps</SelectItem>
                {appNames.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feature Name</TableHead>
                <TableHead>App</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(f => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell><Badge variant="outline">{f.app_name}</Badge></TableCell>
                  <TableCell>
                    <Switch checked={f.enabled} onCheckedChange={() => handleToggle(f.id, f.enabled)} />
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(f.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No features yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Feature Toggle</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Feature Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. ESP, AIM, BulletTrack" />
            </div>
            <div className="space-y-2">
              <Label>App Name</Label>
              <Input value={form.app_name} onChange={e => setForm({ ...form, app_name: e.target.value })} placeholder="e.g. MARS LOADER" className="uppercase" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Enabled by default</Label>
              <Switch checked={form.enabled} onCheckedChange={v => setForm({ ...form, enabled: v })} />
            </div>
          </div>
          <DialogFooter><Button onClick={handleCreate}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
