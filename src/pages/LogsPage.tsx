import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Database } from '@/integrations/supabase/types';

type Log = Database['public']['Tables']['activity_logs']['Row'];

export default function LogsPage() {
  const { role } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    if (role !== 'admin') return;
    supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => { if (data) setLogs(data); });
  }, [role]);

  if (role !== 'admin') return <DashboardLayout><p>Access denied</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <h1 className="page-header mb-6">Activity Logs</h1>
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm">{new Date(l.created_at).toLocaleString()}</TableCell>
                  <TableCell>{l.action}</TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">{JSON.stringify(l.details)}</TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">No logs</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
