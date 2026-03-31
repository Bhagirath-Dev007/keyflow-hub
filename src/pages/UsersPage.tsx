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
import { Search, Plus, Minus, UserCog, Download, Trash2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type AppRole = Database['public']['Enums']['app_role'];

interface UserWithRole extends Profile {
  role: AppRole;
}

export default function UsersPage() {
  const { role } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [walletDialog, setWalletDialog] = useState<{ open: boolean; user: UserWithRole | null; type: 'credit' | 'debit' }>({ open: false, user: null, type: 'credit' });
  const [walletAmount, setWalletAmount] = useState('');
  const [walletNote, setWalletNote] = useState('');
  const [roleDialog, setRoleDialog] = useState<{ open: boolean; user: UserWithRole | null }>({ open: false, user: null });
  const [newRole, setNewRole] = useState<AppRole>('user');
  const { toast } = useToast();

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: roles } = await supabase.from('user_roles').select('*');
    if (profiles && roles) {
      const combined = profiles.map(p => ({
        ...p,
        role: (roles.find(r => r.user_id === p.user_id)?.role || 'user') as AppRole,
      }));
      setUsers(combined);
    }
  };

  useEffect(() => { if (role === 'admin') fetchUsers(); }, [role]);

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const handleWalletUpdate = async () => {
    if (!walletDialog.user || !walletAmount) return;
    const amount = parseFloat(walletAmount);
    if (isNaN(amount) || amount <= 0) { toast({ title: 'Invalid amount', variant: 'destructive' }); return; }

    const newBalance = walletDialog.type === 'credit'
      ? Number(walletDialog.user.wallet_balance) + amount
      : Number(walletDialog.user.wallet_balance) - amount;

    if (newBalance < 0) { toast({ title: 'Insufficient balance', variant: 'destructive' }); return; }

    const { error: updateError } = await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('user_id', walletDialog.user.user_id);
    if (updateError) { toast({ title: 'Error', description: updateError.message, variant: 'destructive' }); return; }

    await supabase.from('transactions').insert({
      user_id: walletDialog.user.user_id,
      amount,
      type: walletDialog.type,
      source: 'admin',
      note: walletNote || `Admin ${walletDialog.type}`,
    });

    toast({ title: 'Success', description: `₹${amount} ${walletDialog.type}ed successfully` });
    setWalletDialog({ open: false, user: null, type: 'credit' });
    setWalletAmount(''); setWalletNote('');
    fetchUsers();
  };

  const handleRoleUpdate = async () => {
    if (!roleDialog.user) return;
    const { error } = await supabase.from('user_roles').update({ role: newRole }).eq('user_id', roleDialog.user.user_id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Role updated' });
    setRoleDialog({ open: false, user: null });
    fetchUsers();
  };

  const handleBanToggle = async (u: UserWithRole) => {
    await supabase.from('profiles').update({ is_banned: !u.is_banned }).eq('user_id', u.user_id);
    fetchUsers();
  };

  const exportCSV = () => {
    const header = 'Name,Email,Role,Balance,Banned\n';
    const rows = filtered.map(u => `${u.name},${u.email},${u.role},${u.wallet_balance},${u.is_banned}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'users.csv'; a.click();
  };

  if (role !== 'admin') return <DashboardLayout><p>Access denied</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="page-header">User Management</h1>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
        </div>

        <div className="mb-4 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="reseller">Reseller</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Wallet (₹)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name || '—'}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{u.role}</Badge></TableCell>
                  <TableCell className="font-mono">₹{Number(u.wallet_balance).toLocaleString('en-IN')}</TableCell>
                  <TableCell>
                    <Badge variant={u.is_banned ? 'destructive' : 'default'}>{u.is_banned ? 'Banned' : 'Active'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setWalletDialog({ open: true, user: u, type: 'credit' })} title="Add Balance">
                        <Plus className="h-4 w-4 text-success" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setWalletDialog({ open: true, user: u, type: 'debit' })} title="Deduct Balance">
                        <Minus className="h-4 w-4 text-destructive" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setRoleDialog({ open: true, user: u }); setNewRole(u.role); }} title="Change Role">
                        <UserCog className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant={u.is_banned ? 'default' : 'destructive'} onClick={() => handleBanToggle(u)}>
                        {u.is_banned ? 'Unban' : 'Ban'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Wallet Dialog */}
      <Dialog open={walletDialog.open} onOpenChange={open => !open && setWalletDialog({ open: false, user: null, type: 'credit' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{walletDialog.type === 'credit' ? 'Add' : 'Deduct'} Balance — {walletDialog.user?.name || walletDialog.user?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input type="number" min="1" value={walletAmount} onChange={e => setWalletAmount(e.target.value)} placeholder="Enter amount" />
            </div>
            <div className="space-y-2">
              <Label>Note / Remark</Label>
              <Input value={walletNote} onChange={e => setWalletNote(e.target.value)} placeholder="e.g. manual top-up" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleWalletUpdate}>{walletDialog.type === 'credit' ? 'Add Balance' : 'Deduct Balance'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Dialog */}
      <Dialog open={roleDialog.open} onOpenChange={open => !open && setRoleDialog({ open: false, user: null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change Role — {roleDialog.user?.name || roleDialog.user?.email}</DialogTitle></DialogHeader>
          <div className="py-4">
            <Select value={newRole} onValueChange={v => setNewRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="reseller">Reseller</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter><Button onClick={handleRoleUpdate}>Update Role</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
