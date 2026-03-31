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

    const { license_key, device_id } = await req.json();

    if (!license_key || !device_id) {
      return new Response(JSON.stringify({ valid: false, error: 'Missing license_key or device_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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

    if (keyData.status === 'revoked') {
      return new Response(JSON.stringify({ valid: false, error: 'Key has been revoked' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const deviceLimit = keyData.device_limit || 1;
    const deviceIds: string[] = keyData.device_ids || [];

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
        valid: true,
        status: 'active',
        plan: keyData.plan_name,
        expires_at: expiry.toISOString(),
        device_limit: deviceLimit,
        devices_used: 1,
        message: 'Key activated and bound to device'
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // If active, check multi-device binding and expiry
    if (keyData.status === 'active') {
      // Check expiry first
      if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
        await supabase.from('license_keys').update({ status: 'expired' }).eq('id', keyData.id);
        return new Response(JSON.stringify({ valid: false, error: 'Key has expired' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if device is already registered
      if (deviceIds.includes(device_id)) {
        return new Response(JSON.stringify({
          valid: true,
          status: 'active',
          plan: keyData.plan_name,
          expires_at: keyData.expires_at,
          device_limit: deviceLimit,
          devices_used: deviceIds.length,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Check if device limit reached
      if (deviceIds.length >= deviceLimit) {
        return new Response(JSON.stringify({
          valid: false,
          error: `Device limit reached (${deviceLimit}). Key is already bound to ${deviceIds.length} device(s).`,
          device_limit: deviceLimit,
          devices_used: deviceIds.length,
        }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Add new device
      const updatedDevices = [...deviceIds, device_id];
      await supabase.from('license_keys').update({
        device_ids: updatedDevices,
        device_id, // keep latest device in legacy field
      }).eq('id', keyData.id);

      return new Response(JSON.stringify({
        valid: true,
        status: 'active',
        plan: keyData.plan_name,
        expires_at: keyData.expires_at,
        device_limit: deviceLimit,
        devices_used: updatedDevices.length,
        message: 'Device registered successfully',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Expired
    return new Response(JSON.stringify({ valid: false, error: 'Key has expired' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ valid: false, error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
