import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, Key, Percent } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type LicenseKey = Database['public']['Tables']['license_keys']['Row'];

export default function ProfitsPage() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [pricing, setPricing] = useState<Record<string, { user_price: number; reseller_price: number }>>({});

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('license_keys').select('*').eq('created_by', user.id),
      supabase.from('pricing').select('*'),
    ]).then(([keysRes, pricingRes]) => {
      if (keysRes.data) setKeys(keysRes.data);
      if (pricingRes.data) {
        const map: typeof pricing = {};
        pricingRes.data.forEach(p => { map[p.plan_name] = { user_price: Number(p.user_price), reseller_price: Number(p.reseller_price) }; });
        setPricing(map);
      }
    });
  }, [user]);

  const soldKeys = keys.filter(k => k.status !== 'unused');
  const totalCost = soldKeys.reduce((s, k) => s + (pricing[k.plan_name]?.reseller_price || 0), 0);
  const totalRevenue = soldKeys.reduce((s, k) => s + (pricing[k.plan_name]?.user_price || 0), 0);
  const totalProfit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';

  const cards = [
    { title: 'Keys Sold', value: soldKeys.length, icon: <Key className="h-5 w-5" />, color: 'text-primary' },
    { title: 'Total Cost', value: `₹${totalCost.toLocaleString('en-IN')}`, icon: <DollarSign className="h-5 w-5" />, color: 'text-warning' },
    { title: 'Total Profit', value: `₹${totalProfit.toLocaleString('en-IN')}`, icon: <TrendingUp className="h-5 w-5" />, color: 'text-success' },
    { title: 'Profit Margin', value: `${margin}%`, icon: <Percent className="h-5 w-5" />, color: 'text-accent' },
  ];

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <h1 className="page-header mb-6">Profit Stats</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {cards.map(c => (
            <Card key={c.title} className="stat-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
                <span className={c.color}>{c.icon}</span>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{c.value}</div></CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
