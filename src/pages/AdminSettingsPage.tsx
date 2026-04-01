import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Upload, Trash2, QrCode } from 'lucide-react';

export default function AdminSettingsPage() {
  const { role } = useAuth();
  const [qrUrl, setQrUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchQr = async () => {
    const { data } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'payment_qr_url')
      .single();
    if (data) setQrUrl(data.setting_value);
  };

  useEffect(() => { fetchQr(); }, []);

  const handleUploadQr = async (file: File) => {
    setUploading(true);
    const fileName = `qr_${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('admin-assets').upload(fileName, file);
    if (uploadError) {
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('admin-assets').getPublicUrl(fileName);
    const newUrl = urlData.publicUrl;

    // Upsert setting
    const { data: existing } = await supabase.from('admin_settings').select('id').eq('setting_key', 'payment_qr_url').single();
    if (existing) {
      await supabase.from('admin_settings').update({ setting_value: newUrl }).eq('setting_key', 'payment_qr_url');
    } else {
      await supabase.from('admin_settings').insert({ setting_key: 'payment_qr_url', setting_value: newUrl });
    }

    setQrUrl(newUrl);
    toast({ title: 'QR code updated!' });
    setUploading(false);
  };

  const handleRemoveQr = async () => {
    await supabase.from('admin_settings').update({ setting_value: '' }).eq('setting_key', 'payment_qr_url');
    setQrUrl('');
    toast({ title: 'QR code removed' });
  };

  if (role !== 'admin') return <DashboardLayout><p>Access denied</p></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <h1 className="page-header mb-6">Admin Settings</h1>

        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" /> Payment QR Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a QR code image that resellers will see when adding wallet balance. They'll scan this to make payment.
            </p>

            {qrUrl ? (
              <div className="space-y-3">
                <img src={qrUrl} alt="Payment QR" className="mx-auto max-w-[250px] rounded-xl border" />
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                    <Upload className="mr-2 h-4 w-4" /> Replace
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleRemoveQr}>
                    <Trash2 className="mr-2 h-4 w-4" /> Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/30 p-10 transition-colors hover:border-primary hover:text-primary"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Click to upload QR code</p>
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleUploadQr(file);
                e.target.value = '';
              }}
            />
            {uploading && <p className="text-sm text-center text-muted-foreground">Uploading...</p>}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
