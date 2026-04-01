import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ShoppingCart } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Pricing = Database['public']['Tables']['pricing']['Row'];

function generateKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  ).join('-');
}

export default function BuyKeysPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [plans, setPlans] = useState<Pricing[]>([]);
  const [buyOpen, setBuyOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [deviceLimit, setDeviceLimit] = useState('1');
  const { toast } = useToast();

  useEffect(() => {
    supabase.from('pricing').select('*').order('user_price').then(({ data }) => { if (data) setPlans(data); });
  }, []);

  const calcCost = (qty: number, devices: number) => qty * (10 + devices * 20);

  const handleBuy = async () => {
    const plan = plans.find(p => p.id === selectedPlan);
    if (!plan || !user || !profile) return;
    const qty = parseInt(quantity) || 1;
    const devices = parseInt(deviceLimit) || 1;
    const totalCost = calcCost(qty, devices);

    if (Number(profile.wallet_balance) < totalCost) {
      toast({ title: 'Insufficient balance', description: `Need ₹${totalCost}, you have ₹${Number(profile.wallet_balance)}`, variant: 'destructive' }); return;
    }

    // Deduct wallet
    const newBalance = Number(profile.wallet_balance) - totalCost;
    await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('user_id', user.id);

    // Create keys
    const keys = Array.from({ length: qty }, () => ({
      key: generateKey(),
      plan_name: plan.plan_name,
      duration_days: plan.duration_days,
      created_by: user.id,
      device_limit: devices,
    }));
    await supabase.from('license_keys').insert(keys);

    // Log transaction
    await supabase.from('transactions').insert({
      user_id: user.id,
      amount: totalCost,
      type: 'debit' as const,
      source: 'purchase' as const,
      note: `Purchased ${qty}x ${plan.plan_name} keys (${devices} device${devices > 1 ? 's' : ''})`,
    });

    toast({ title: `${qty} key(s) purchased for ₹${totalCost}` });
    setBuyOpen(false);
    refreshProfile();
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="page-header">Buy Keys</h1>
          <Button onClick={() => setBuyOpen(true)}><ShoppingCart className="mr-2 h-4 w-4" />Purchase</Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map(p => (
            <Card key={p.id} className="stat-card">
              <CardHeader>
                <CardTitle>{p.plan_name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{p.duration_days} days</p>
                <p className="text-lg font-bold font-mono text-primary">₹{Number(p.reseller_price).toLocaleString('en-IN')}</p>
                <p className="text-xs text-muted-foreground">User price: ₹{Number(p.user_price).toLocaleString('en-IN')}</p>
                <p className="text-xs text-success font-medium">Profit: ₹{(Number(p.user_price) - Number(p.reseller_price)).toLocaleString('en-IN')} / key</p>
              </CardContent>
            </Card>
          ))}
          {plans.length === 0 && <p className="text-muted-foreground">No plans available</p>}
        </div>
      </div>

      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Purchase Keys</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                <SelectContent>
                  {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.plan_name} — ₹{p.reseller_price}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Quantity</Label><Input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} /></div>
            {selectedPlan && (
              <p className="text-sm font-medium">
                Total: ₹{((plans.find(p => p.id === selectedPlan)?.reseller_price || 0) * (parseInt(quantity) || 1)).toLocaleString('en-IN')}
              </p>
            )}
          </div>
          <DialogFooter><Button onClick={handleBuy}>Confirm Purchase</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
