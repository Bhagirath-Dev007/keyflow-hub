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

    const { code, user_id } = await req.json();

    if (!code || !user_id) {
      return new Response(JSON.stringify({ success: false, error: 'Missing code or user_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Find the referral code
    const { data: referral, error: findErr } = await supabase
      .from('referral_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (findErr || !referral) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid referral code' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check max uses
    if (referral.current_uses >= referral.max_uses) {
      return new Response(JSON.stringify({ success: false, error: 'Referral code has been fully used' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user already used this code
    const { data: existingUse } = await supabase
      .from('referral_uses')
      .select('id')
      .eq('referral_code_id', referral.id)
      .eq('used_by', user_id)
      .single();

    if (existingUse) {
      return new Response(JSON.stringify({ success: false, error: 'You have already used this referral code' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Apply bonus balance
    if (referral.bonus_balance > 0) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('user_id', user_id)
        .single();

      if (profile) {
        const newBalance = Number(profile.wallet_balance) + Number(referral.bonus_balance);
        await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('user_id', user_id);

        await supabase.from('transactions').insert({
          user_id,
          amount: referral.bonus_balance,
          type: 'credit',
          source: 'system',
          note: `Referral code ${referral.code} bonus`,
        });
      }
    }

    // Record usage
    await supabase.from('referral_uses').insert({
      referral_code_id: referral.id,
      used_by: user_id,
    });

    // Increment usage count
    await supabase.from('referral_codes').update({
      current_uses: referral.current_uses + 1,
    }).eq('id', referral.id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Referral code applied successfully',
      bonus_balance: referral.bonus_balance,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
