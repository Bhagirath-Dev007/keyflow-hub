import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, Upload, Clock, CheckCircle, XCircle, Image } from 'lucide-react';

const AMOUNT_OPTIONS = [
  1000, 2000, 3000, 5000, 7000, 10000, 15000, 20000, 25000, 30000, 40000, 50000, 75000, 100000,
];

interface WalletRequest {
  id: string;
  user_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  screenshot_url: string | null;
  admin_note: string | null;
  created_at: string;
}

export default function AddBalancePage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<WalletRequest[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState('');
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchRequests = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('wallet_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setRequests(data as WalletRequest[]);
  };

  const fetchQrImage = async () => {
    const { data } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'payment_qr_url')
      .single();
    if (data) setQrImageUrl(data.setting_value);
  };

  useEffect(() => {
    fetchRequests();
    fetchQrImage();
  }, [user]);

  const handleSubmitRequest = async () => {
    if (!selectedAmount || !user) return;
    const amount = parseInt(selectedAmount);

    if (!screenshot) {
      toast({ title: 'Please upload payment screenshot', variant: 'destructive' });
      return;
    }

    setUploading(true);
    // Upload screenshot
    const fileName = `${user.id}/${Date.now()}_${screenshot.name}`;
    const { error: uploadError } = await supabase.storage
      .from('payment-screenshots')
      .upload(fileName, screenshot);

    if (uploadError) {
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('payment-screenshots').getPublicUrl(fileName);

    const { error } = await supabase.from('wallet_requests').insert({
      user_id: user.id,
      amount,
      screenshot_url: urlData.publicUrl,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Request submitted! Admin will review your payment.' });
      setDialogOpen(false);
      setSelectedAmount('');
      setScreenshot(null);
      setShowQr(false);
      fetchRequests();
    }
    setUploading(false);
  };

  const statusIcon = (s: string) => {
    switch (s) {
      case 'pending': return <Clock className="h-4 w-4 text-warning" />;
      case 'approved': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const statusVariant = (s: string) => {
    switch (s) {
      case 'pending': return 'secondary' as const;
      case 'approved': return 'default' as const;
      case 'rejected': return 'destructive' as const;
      default: return 'secondary' as const;
    }
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h1 className="page-header">Add Balance</h1>
          <Button onClick={() => setDialogOpen(true)}>
            <CreditCard className="mr-2 h-4 w-4" />New Request
          </Button>
        </div>

        <h2 className="mb-4 text-lg font-semibold">Payment Requests</h2>
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Screenshot</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Admin Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell className="font-mono font-semibold">₹{Number(r.amount).toLocaleString('en-IN')}</TableCell>
                  <TableCell>
                    {r.screenshot_url ? (
                      <a href={r.screenshot_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                        <Image className="h-3.5 w-3.5" /> View
                      </a>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(r.status)} className="capitalize flex items-center gap-1 w-fit">
                      {statusIcon(r.status)} {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.admin_note || '—'}</TableCell>
                </TableRow>
              ))}
              {requests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No payment requests yet</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Wallet Balance</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Select Amount</Label>
              <Select value={selectedAmount} onValueChange={(v) => { setSelectedAmount(v); setShowQr(true); }}>
                <SelectTrigger><SelectValue placeholder="Choose amount" /></SelectTrigger>
                <SelectContent>
                  {AMOUNT_OPTIONS.map(a => (
                    <SelectItem key={a} value={String(a)}>₹{a.toLocaleString('en-IN')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showQr && selectedAmount && (
              <>
                <div className="rounded-xl border bg-muted/50 p-4 text-center space-y-3">
                  <p className="text-sm font-medium">Pay ₹{parseInt(selectedAmount).toLocaleString('en-IN')} using the QR code below</p>
                  {qrImageUrl ? (
                    <img src={qrImageUrl} alt="Payment QR" className="mx-auto max-w-[220px] rounded-lg border" />
                  ) : (
                    <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30">
                      <p className="text-xs text-muted-foreground">QR code not set by admin</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Upload Payment Screenshot</Label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 p-6 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    <Upload className="h-5 w-5" />
                    <span className="text-sm">{screenshot ? screenshot.name : 'Click to upload screenshot'}</span>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => setScreenshot(e.target.files?.[0] || null)}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSubmitRequest} disabled={!selectedAmount || !screenshot || uploading}>
              {uploading ? 'Uploading...' : 'Submit Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
