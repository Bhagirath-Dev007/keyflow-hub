import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Key, Wallet, TrendingUp, ShoppingCart } from 'lucide-react';

export default function ResellerDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({ totalKeys: 0, soldKeys: 0, unsoldKeys: 0 });

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [totalRes, soldRes] = await Promise.all([
        supabase.from('license_keys').select('id', { count: 'exact', head: true }).eq('created_by', user.id),
        supabase.from('license_keys').select('id', { count: 'exact', head: true }).eq('created_by', user.id).neq('status', 'unused'),
      ]);
      const total = totalRes.count || 0;
      const sold = soldRes.count || 0;
      setStats({ totalKeys: total, soldKeys: sold, unsoldKeys: total - sold });
    };
    fetch();
  }, [user]);

  const cards = [
    { title: 'Wallet Balance', value: `₹${Number(profile?.wallet_balance || 0).toLocaleString('en-IN')}`, icon: <Wallet className="h-5 w-5" />, color: 'text-primary' },
    { title: 'Total Keys', value: stats.totalKeys, icon: <Key className="h-5 w-5" />, color: 'text-accent' },
    { title: 'Keys Sold', value: stats.soldKeys, icon: <ShoppingCart className="h-5 w-5" />, color: 'text-success' },
    { title: 'Keys Available', value: stats.unsoldKeys, icon: <TrendingUp className="h-5 w-5" />, color: 'text-warning' },
  ];

  return (
    <div className="animate-fade-in">
      <h1 className="page-header mb-6">Reseller Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
