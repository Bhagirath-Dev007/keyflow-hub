import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Paintbrush, Upload, Trash2 } from 'lucide-react';

export default function BrandingPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [panelName, setPanelName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Sync state when profile loads
  useEffect(() => {
    if (profile) {
      setPanelName(profile.panel_name || '');
      setLogoUrl(profile.logo_url || '');
    }
  }, [profile]);

  const handleUploadLogo = async (file: File) => {
    if (!user) return;
    
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Please upload PNG, JPEG or WebP image', variant: 'destructive' });
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const fileName = `logos/${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('admin-assets').upload(fileName, file, {
      contentType: file.type,
      upsert: true,
    });
    if (error) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from('admin-assets').getPublicUrl(fileName);
    setLogoUrl(data.publicUrl);
    setUploading(false);
    toast({ title: 'Logo uploaded! Click Save to apply.' });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      panel_name: panelName,
      logo_url: logoUrl,
    }).eq('user_id', user.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Branding updated!' });
      refreshProfile();
    }
    setSaving(false);
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <h1 className="page-header mb-6">Panel Branding</h1>

        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Paintbrush className="h-5 w-5" /> Customize Your Panel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Panel Name</Label>
              <Input value={panelName} onChange={e => setPanelName(e.target.value)} placeholder="e.g. My Reseller Panel" />
              <p className="text-xs text-muted-foreground">This name appears in the sidebar header</p>
            </div>

            <div className="space-y-2">
              <Label>Panel Logo (PNG, JPEG)</Label>
              {logoUrl ? (
                <div className="flex items-center gap-4">
                  <img src={logoUrl} alt="Logo" className="h-16 w-16 rounded-xl object-cover border" />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                      <Upload className="mr-1 h-3.5 w-3.5" /> Change
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setLogoUrl('')}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 p-8 transition-colors hover:border-primary hover:text-primary"
                >
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Click to upload logo</span>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadLogo(file);
                  e.target.value = '';
                }}
              />
              {uploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? 'Saving...' : 'Save Branding'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
