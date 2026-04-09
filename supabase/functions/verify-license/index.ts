import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { license_key, device_id, app_name } = await req.json();

    if (!license_key || !device_id || !app_name) {
      return new Response(JSON.stringify({ valid: false, error: 'Missing license_key, device_id, or app_name' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check mod config master switch
    const { data: modConfig } = await supabase
      .from('mod_config')
      .select('*')
      .eq('app_name', app_name)
      .single();

    if (modConfig && !modConfig.master_switch) {
      return new Response(JSON.stringify({
        valid: false,
        error: 'Mod is currently offline',
        status_text: modConfig.status_text,
        mod_name: modConfig.mod_name,
      }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: keyData, error: findErr } = await supabase
      .from('license_keys')
      .select('*')
      .eq('key', license_key)
      .single();

    if (findErr || !keyData) {
      return new Response(JSON.stringify({ valid: false, error: 'Invalid license key' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (keyData.app_name !== app_name) {
      return new Response(JSON.stringify({ valid: false, error: `This key is for "${keyData.app_name}", not "${app_name}"` }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (keyData.status === 'revoked') {
      return new Response(JSON.stringify({ valid: false, error: 'Key has been revoked' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (keyData.status === 'expired') {
      return new Response(JSON.stringify({ valid: false, error: 'Key has expired' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const deviceLimit = keyData.device_limit || 1;
    const deviceIds: string[] = keyData.device_ids || [];

    // Fetch features for this app
    const { data: features } = await supabase
      .from('features')
      .select('name, enabled')
      .eq('app_name', app_name);

    const featureFlags = (features || []).reduce((acc: Record<string, boolean>, f: any) => {
      acc[f.name] = f.enabled;
      return acc;
    }, {});

    const baseResponse = {
      plan: keyData.plan_name,
      app_name: keyData.app_name,
      device_limit: deviceLimit,
      features: featureFlags,
      mod_name: modConfig?.mod_name || '',
      status_text: modConfig?.status_text || '',
    };

    // If unused, activate and bind first device
    if (keyData.status === 'unused') {
      const now = new Date();
      const expiry = new Date(now.getTime() + keyData.duration_days * 86400000);

      await supabase.from('license_keys').update({
        status: 'active',
        device_id,
        device_ids: [device_id],
        activated_at: now.toISOString(),
        expires_at: expiry.toISOString(),
      }).eq('id', keyData.id);

      return new Response(JSON.stringify({
        valid: true, status: 'active',
        ...baseResponse,
        expires_at: expiry.toISOString(),
        devices_used: 1,
        message: 'Key activated and bound to device'
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // If active
    if (keyData.status === 'active') {
      if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
        await supabase.from('license_keys').update({ status: 'expired' }).eq('id', keyData.id);
        return new Response(JSON.stringify({ valid: false, error: 'Key has expired', status: 'expired' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (deviceIds.includes(device_id)) {
        return new Response(JSON.stringify({
          valid: true, status: 'active',
          ...baseResponse,
          expires_at: keyData.expires_at,
          devices_used: deviceIds.length,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (deviceIds.length >= deviceLimit) {
        return new Response(JSON.stringify({
          valid: false,
          error: `Device limit reached (${deviceLimit}). Key is already bound to ${deviceIds.length} device(s).`,
          device_limit: deviceLimit,
          devices_used: deviceIds.length,
        }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const updatedDevices = [...deviceIds, device_id];
      await supabase.from('license_keys').update({ device_ids: updatedDevices, device_id }).eq('id', keyData.id);

      return new Response(JSON.stringify({
        valid: true, status: 'active',
        ...baseResponse,
        expires_at: keyData.expires_at,
        devices_used: updatedDevices.length,
        message: 'Device registered successfully',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ valid: false, error: 'Key has expired', status: 'expired' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ valid: false, error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
