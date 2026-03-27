import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Wallet as WalletIcon } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Transaction = Database['public']['Tables']['transactions']['Row'];

export default function WalletPage() {
  const { user, profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from('transactions').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { if (data) setTransactions(data); });
  }, [user]);

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <h1 className="page-header mb-6">Wallet</h1>

        <Card className="stat-card mb-6">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Balance</CardTitle>
            <WalletIcon className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">₹{Number(profile?.wallet_balance || 0).toLocaleString('en-IN')}</div>
          </CardContent>
        </Card>

        <h2 className="mb-4 text-lg font-semibold">Transaction History</h2>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm">{new Date(t.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={t.type === 'credit' ? 'default' : 'destructive'} className="capitalize">{t.type}</Badge>
                  </TableCell>
                  <TableCell className="font-mono">{t.type === 'credit' ? '+' : '-'}₹{Number(t.amount).toLocaleString('en-IN')}</TableCell>
                  <TableCell className="capitalize">{t.source}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.note || '—'}</TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No transactions yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
