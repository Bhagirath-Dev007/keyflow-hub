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

    const { app_name } = await req.json();

    if (!app_name) {
      return new Response(JSON.stringify({ error: 'Missing app_name' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch mod config
    const { data: modConfig } = await supabase
      .from('mod_config')
      .select('*')
      .eq('app_name', app_name)
      .single();

    // Fetch features
    const { data: features } = await supabase
      .from('features')
      .select('name, enabled')
      .eq('app_name', app_name);

    const featureFlags = (features || []).reduce((acc: Record<string, boolean>, f: any) => {
      acc[f.name] = f.enabled;
      return acc;
    }, {});

    return new Response(JSON.stringify({
      app_name,
      mod_name: modConfig?.mod_name || app_name,
      status_text: modConfig?.status_text || '',
      master_switch: modConfig?.master_switch ?? true,
      online: modConfig?.master_switch ?? true,
      features: featureFlags,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
