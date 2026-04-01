import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, UserPlus } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function ResellerUsersPage() {
  const { user, role, profile, refreshProfile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addName, setAddName] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [creditOpen, setCreditOpen] = useState(false);
  const [creditUser, setCreditUser] = useState<Profile | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNote, setCreditNote] = useState('');
  const { toast } = useToast();

  const fetchUsers = async () => {
    // Reseller sees all users (role = 'user') — in a real system you'd track which reseller created which user
    const { data } = await supabase.from('profiles').select('*');
    if (data) {
      // Get roles to filter only 'user' role
      const { data: roles } = await supabase.from('user_roles').select('*');
      const userIds = new Set((roles || []).filter(r => r.role === 'user').map(r => r.user_id));
      setUsers(data.filter(p => userIds.has(p.user_id)));
    }
  };

  useEffect(() => { if (user && role === 'reseller') fetchUsers(); }, [user, role]);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddUser = async () => {
    if (!addEmail || !addPassword) {
      toast({ title: 'Email and password required', variant: 'destructive' }); return;
    }
    // Sign up a new user via supabase auth
    const { error } = await supabase.auth.signUp({
      email: addEmail,
      password: addPassword,
      options: { data: { name: addName } },
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' }); return;
    }
    toast({ title: 'User created! They will get a verification email.' });
    setAddOpen(false); setAddEmail(''); setAddName(''); setAddPassword('');
    // Refresh after a delay to let the trigger create the profile
    setTimeout(fetchUsers, 2000);
  };

  const handleCreditBalance = async () => {
    if (!creditUser || !creditAmount) return;
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) { toast({ title: 'Invalid amount', variant: 'destructive' }); return; }

    // Check reseller's own wallet
    const resellerBalance = Number(profile?.wallet_balance || 0);
    if (resellerBalance < amount) {
      toast({ title: 'Insufficient wallet balance', description: `You have ₹${resellerBalance}`, variant: 'destructive' }); return;
    }

    // Deduct from reseller wallet
    await supabase.from('profiles').update({ wallet_balance: resellerBalance - amount }).eq('user_id', user!.id);

    // Credit to user wallet
    const newUserBalance = Number(creditUser.wallet_balance) + amount;
    await supabase.from('profiles').update({ wallet_balance: newUserBalance }).eq('user_id', creditUser.user_id);

    // Log transactions for both
    await supabase.from('transactions').insert([
      {
        user_id: user!.id,
        amount,
        type: 'debit' as const,
        source: 'reseller' as const,
        note: creditNote || `Transferred to ${creditUser.name || creditUser.email}`,
      },
      {
        user_id: creditUser.user_id,
        amount,
        type: 'credit' as const,
        source: 'reseller' as const,
        note: creditNote || `Received from reseller`,
      },
    ]);

    toast({ title: `₹${amount} credited to ${creditUser.name || creditUser.email}` });
    setCreditOpen(false); setCreditUser(null); setCreditAmount(''); setCreditNote('');
    refreshProfile();
    fetchUsers();
  };

  if (role !== 'reseller') return <DashboardLayout><p>Access denied</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="page-header">My Users</h1>
          <Button onClick={() => setAddOpen(true)}><UserPlus className="mr-2 h-4 w-4" />Add User</Button>
        </div>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
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
                  <TableCell className="font-mono">₹{Number(u.wallet_balance).toLocaleString('en-IN')}</TableCell>
                  <TableCell>
                    <Badge variant={u.is_banned ? 'destructive' : 'default'}>{u.is_banned ? 'Banned' : 'Active'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => { setCreditUser(u); setCreditOpen(true); }} title="Add Balance">
                      <Plus className="h-4 w-4 text-primary" /> Add Balance
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No users found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add User Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={addName} onChange={e => setAddName(e.target.value)} placeholder="User name" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={addPassword} onChange={e => setAddPassword(e.target.value)} placeholder="Minimum 6 characters" />
            </div>
          </div>
          <DialogFooter><Button onClick={handleAddUser}>Create User</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit Balance Dialog */}
      <Dialog open={creditOpen} onOpenChange={open => { if (!open) { setCreditOpen(false); setCreditUser(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Balance — {creditUser?.name || creditUser?.email}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input type="number" min="1" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} placeholder="Enter amount" />
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Input value={creditNote} onChange={e => setCreditNote(e.target.value)} placeholder="Optional note" />
            </div>
            <p className="text-xs text-muted-foreground">Your wallet: ₹{Number(profile?.wallet_balance || 0).toLocaleString('en-IN')}</p>
          </div>
          <DialogFooter><Button onClick={handleCreditBalance}>Transfer Balance</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
