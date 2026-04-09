import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Key, Wallet, CreditCard, Gift, Crown } from 'lucide-react';

export default function AdminDashboard() {
  const { isOwner } = useAuth();
  const [stats, setStats] = useState({ users: 0, keys: 0, activeKeys: 0, totalBalance: 0, pendingRequests: 0, referralCodes: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [usersRes, keysRes, activeKeysRes, balanceRes, pendingRes, referralsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('license_keys').select('id', { count: 'exact', head: true }),
        supabase.from('license_keys').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('profiles').select('wallet_balance'),
        supabase.from('wallet_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('referral_codes').select('id', { count: 'exact', head: true }),
      ]);
      const totalBalance = balanceRes.data?.reduce((s, p) => s + Number(p.wallet_balance), 0) || 0;
      setStats({
        users: usersRes.count || 0,
        keys: keysRes.count || 0,
        activeKeys: activeKeysRes.count || 0,
        totalBalance,
        pendingRequests: pendingRes.count || 0,
        referralCodes: referralsRes.count || 0,
      });
    };
    fetchStats();
  }, []);

  const cards = [
    { title: 'Total Users', value: stats.users, icon: <Users className="h-5 w-5" />, color: 'text-primary' },
    { title: 'Total Keys', value: stats.keys, icon: <Key className="h-5 w-5" />, color: 'text-accent' },
    { title: 'Active Keys', value: stats.activeKeys, icon: <Key className="h-5 w-5" />, color: 'text-success' },
    { title: 'Total Balance', value: `₹${stats.totalBalance.toLocaleString('en-IN')}`, icon: <Wallet className="h-5 w-5" />, color: 'text-warning' },
    { title: 'Pending Requests', value: stats.pendingRequests, icon: <CreditCard className="h-5 w-5" />, color: 'text-destructive' },
    { title: 'Referral Codes', value: stats.referralCodes, icon: <Gift className="h-5 w-5" />, color: 'text-info' },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-6">
        {isOwner && <Crown className="h-6 w-6 text-warning" />}
        <h1 className="page-header">{isOwner ? 'Owner' : 'Admin'} Dashboard</h1>
      </div>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {cards.map(c => (
          <Card key={c.title} className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
              <span className={c.color}>{c.icon}</span>
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
