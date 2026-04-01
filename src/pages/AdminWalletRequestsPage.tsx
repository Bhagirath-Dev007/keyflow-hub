import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Clock, Image, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface WalletRequest {
  id: string;
  user_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  screenshot_url: string | null;
  admin_note: string | null;
  created_at: string;
}

interface Profile {
  user_id: string;
  name: string;
  email: string;
  wallet_balance: number;
}

export default function AdminWalletRequestsPage() {
  const { role } = useAuth();
  const [requests, setRequests] = useState<(WalletRequest & { profile?: Profile })[]>([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [actionDialog, setActionDialog] = useState<{ open: boolean; request: WalletRequest | null; action: 'approve' | 'reject' }>({ open: false, request: null, action: 'approve' });
  const [adminNote, setAdminNote] = useState('');
  const { toast } = useToast();

  const fetchRequests = async () => {
    const { data: reqs } = await supabase
      .from('wallet_requests')
      .select('*')
      .order('created_at', { ascending: false });
    const { data: profiles } = await supabase.from('profiles').select('user_id, name, email, wallet_balance');

    if (reqs && profiles) {
      const profileMap = new Map(profiles.map(p => [p.user_id, p]));
      setRequests(reqs.map(r => ({ ...r, profile: profileMap.get(r.user_id) })) as any);
    }
  };

  useEffect(() => { if (role === 'admin') fetchRequests(); }, [role]);

  const filtered = requests.filter(r => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchSearch = !search || r.profile?.name?.toLowerCase().includes(search.toLowerCase()) || r.profile?.email?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleAction = async () => {
    const req = actionDialog.request;
    if (!req) return;

    const newStatus = actionDialog.action === 'approve' ? 'approved' : 'rejected';

    // Update request status
    await supabase.from('wallet_requests').update({
      status: newStatus,
      admin_note: adminNote,
    }).eq('id', req.id);

    // If approved, credit the user's wallet
    if (actionDialog.action === 'approve') {
      const profile = requests.find(r => r.id === req.id)?.profile;
      if (profile) {
        const newBalance = Number(profile.wallet_balance) + Number(req.amount);
        await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('user_id', req.user_id);

        // Log transaction
        await supabase.from('transactions').insert({
          user_id: req.user_id,
          amount: req.amount,
          type: 'credit' as const,
          source: 'admin' as const,
          note: `Balance request approved${adminNote ? ': ' + adminNote : ''}`,
        });
      }
    }

    toast({ title: `Request ${newStatus}` });
    setActionDialog({ open: false, request: null, action: 'approve' });
    setAdminNote('');
    fetchRequests();
  };

  if (role !== 'admin') return <DashboardLayout><p>Access denied</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <h1 className="page-header mb-6">Wallet Requests</h1>

        <div className="mb-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name/email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Screenshot</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.profile?.name || '—'}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.profile?.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono font-semibold whitespace-nowrap">₹{Number(r.amount).toLocaleString('en-IN')}</TableCell>
                  <TableCell>
                    {r.screenshot_url ? (
                      <a href={r.screenshot_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                        <Image className="h-3.5 w-3.5" /> View
                      </a>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary'} className="capitalize flex items-center gap-1 w-fit">
                      {r.status === 'pending' && <Clock className="h-3 w-3" />}
                      {r.status === 'approved' && <CheckCircle className="h-3 w-3" />}
                      {r.status === 'rejected' && <XCircle className="h-3 w-3" />}
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {r.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="default" onClick={() => setActionDialog({ open: true, request: r, action: 'approve' })}>
                          <CheckCircle className="mr-1 h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setActionDialog({ open: true, request: r, action: 'reject' })}>
                          <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                        </Button>
                      </div>
                    )}
                    {r.status !== 'pending' && (
                      <span className="text-xs text-muted-foreground">{r.admin_note || '—'}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No requests found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={actionDialog.open} onOpenChange={open => !open && setActionDialog({ open: false, request: null, action: 'approve' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionDialog.action === 'approve' ? 'Approve' : 'Reject'} Payment Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm">
              Amount: <span className="font-mono font-bold">₹{Number(actionDialog.request?.amount || 0).toLocaleString('en-IN')}</span>
            </p>
            {actionDialog.request?.screenshot_url && (
              <div>
                <Label className="mb-2 block">Payment Screenshot</Label>
                <img src={actionDialog.request.screenshot_url} alt="Payment screenshot" className="max-h-64 rounded-lg border" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Admin Note (optional)</Label>
              <Input value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="Add a note..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant={actionDialog.action === 'approve' ? 'default' : 'destructive'} onClick={handleAction}>
              {actionDialog.action === 'approve' ? 'Approve & Credit' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
