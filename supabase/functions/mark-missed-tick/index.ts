/**
 * Panggil RPC `mark_missed_tasks_tick` (Fase 6) dengan service role.
 * Jadwalkan via Supabase Cron / platform eksternal setiap ~15 menit.
 *
 * Header: Authorization: Bearer <SERVICE_ROLE_KEY>
 *   atau x-mark-missed-secret sama dengan secret Edge `MARK_MISSED_CRON_SECRET`.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-mark-missed-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const cronSecret = Deno.env.get('MARK_MISSED_CRON_SECRET') ?? '';

  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const auth = req.headers.get('Authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const headerSecret = req.headers.get('x-mark-missed-secret')?.trim() ?? '';

  const okAuth =
    bearer === serviceKey ||
    (cronSecret.length > 0 && headerSecret === cronSecret);

  if (!okAuth) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(url, serviceKey);
  const { data, error } = await admin.rpc('mark_missed_tasks_tick');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ inserted_or_processed: data ?? 0 }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
