import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Key, Wallet, Clock, CheckCircle } from 'lucide-react';

export default function UserDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({ activeKeys: 0, expiredKeys: 0 });

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [activeRes, expiredRes] = await Promise.all([
        supabase.from('license_keys').select('id', { count: 'exact', head: true }).eq('assigned_to', user.id).eq('status', 'active'),
        supabase.from('license_keys').select('id', { count: 'exact', head: true }).eq('assigned_to', user.id).eq('status', 'expired'),
      ]);
      setStats({ activeKeys: activeRes.count || 0, expiredKeys: expiredRes.count || 0 });
    };
    fetch();
  }, [user]);

  const cards = [
    { title: 'Wallet Balance', value: `₹${Number(profile?.wallet_balance || 0).toLocaleString('en-IN')}`, icon: <Wallet className="h-5 w-5" />, color: 'text-primary' },
    { title: 'Active Keys', value: stats.activeKeys, icon: <CheckCircle className="h-5 w-5" />, color: 'text-success' },
    { title: 'Expired Keys', value: stats.expiredKeys, icon: <Clock className="h-5 w-5" />, color: 'text-destructive' },
  ];

  return (
    <div className="animate-fade-in">
      <h1 className="page-header mb-6">My Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(c => (
          <Card key={c.title} className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
              <span className={c.color}>{c.icon}</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
