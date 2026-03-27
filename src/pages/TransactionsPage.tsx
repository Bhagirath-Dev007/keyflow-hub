import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Transaction = Database['public']['Tables']['transactions']['Row'];

export default function TransactionsPage() {
  const { user, role } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!user) return;
    let query = supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(200);
    if (role !== 'admin') query = query.eq('user_id', user.id);
    query.then(({ data }) => { if (data) setTransactions(data); });
  }, [user, role]);

  const exportCSV = () => {
    const header = 'Date,Type,Amount,Source,Note\n';
    const rows = transactions.map(t => `${t.created_at},${t.type},${t.amount},${t.source},${t.note || ''}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'transactions.csv'; a.click();
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="page-header">Transactions</h1>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
        </div>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount (₹)</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm">{new Date(t.created_at).toLocaleString()}</TableCell>
                  <TableCell><Badge variant={t.type === 'credit' ? 'default' : 'destructive'} className="capitalize">{t.type}</Badge></TableCell>
                  <TableCell className="font-mono">{t.type === 'credit' ? '+' : '-'}₹{Number(t.amount).toLocaleString('en-IN')}</TableCell>
                  <TableCell className="capitalize">{t.source}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.note || '—'}</TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No transactions</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
