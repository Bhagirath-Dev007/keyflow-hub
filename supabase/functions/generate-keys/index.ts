import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  ).join('-');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user role
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const role = roleData?.role;
    if (!role || !['owner', 'admin', 'reseller'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { plan_name, app_name, duration_days, count, device_limit, custom_key } = body;

    // Validate inputs
    if (!plan_name || typeof plan_name !== 'string' || plan_name.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'plan_name is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (!app_name || typeof app_name !== 'string' || app_name.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'app_name is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const numCount = custom_key ? 1 : Math.min(Math.max(parseInt(count) || 1, 1), 100);
    const numDuration = Math.max(parseInt(duration_days) || 30, 1);
    const numDeviceLimit = Math.max(parseInt(device_limit) || 1, 1);

    const isAdminOrOwner = role === 'owner' || role === 'admin';

    // For resellers: enforce server-side wallet deduction
    if (!isAdminOrOwner) {
      const totalCost = numCount * (10 + numDeviceLimit * 20);

      // Get current balance
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('wallet_balance, is_banned')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        return new Response(JSON.stringify({ error: 'Profile not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (profile.is_banned) {
        return new Response(JSON.stringify({ error: 'Account is banned' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const currentBalance = Number(profile.wallet_balance);
      if (currentBalance < totalCost) {
        return new Response(JSON.stringify({ 
          error: 'Insufficient wallet balance',
          required: totalCost,
          available: currentBalance 
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Atomically deduct balance
      const newBalance = currentBalance - totalCost;
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({ wallet_balance: newBalance })
        .eq('user_id', user.id);

      if (updateErr) {
        return new Response(JSON.stringify({ error: 'Failed to deduct balance' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Record transaction
      await supabaseAdmin.from('transactions').insert({
        user_id: user.id,
        amount: totalCost,
        type: 'debit',
        source: 'purchase',
        note: `Generated ${numCount}x ${plan_name} key(s) (${numDeviceLimit} device${numDeviceLimit > 1 ? 's' : ''})`,
      });
    }

    // Generate keys
    const newKeys = Array.from({ length: numCount }, () => ({
      key: custom_key ? custom_key.trim() : generateKey(),
      plan_name: plan_name.trim(),
      duration_days: numDuration,
      created_by: user.id,
      device_limit: numDeviceLimit,
      app_name: app_name.trim().toUpperCase(),
    }));

    const { data: insertedKeys, error: insertErr } = await supabaseAdmin
      .from('license_keys')
      .insert(newKeys)
      .select('id, key, plan_name, duration_days, device_limit, app_name, status');

    if (insertErr) {
      // If key insertion fails and we already deducted, refund
      if (!isAdminOrOwner) {
        const totalCost = numCount * (10 + numDeviceLimit * 20);
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('wallet_balance')
          .eq('user_id', user.id)
          .single();
        if (profile) {
          await supabaseAdmin
            .from('profiles')
            .update({ wallet_balance: Number(profile.wallet_balance) + totalCost })
            .eq('user_id', user.id);
        }
      }
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      keys: insertedKeys,
      count: numCount,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
