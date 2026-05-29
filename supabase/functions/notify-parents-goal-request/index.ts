/**
 * Push Expo ke ortu saat pengajuan target (goal_requests pending).
 * - Invoke dari app: body { goal_request_id }, header Authorization (JWT).
 * - Webhook DB: INSERT goal_requests, header `x-task-webhook-secret` = `TASK_PENDING_WEBHOOK_SECRET`
 *   (sama dengan notify-parents-task-pending), payload `record` berisi baris baru.
 *
 * Saluran Android: `task-review` (sama register-parent-push).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-task-webhook-secret',
};

type JwtBody = { goal_request_id?: string };

type WebhookPayload = {
  type?: string;
  table?: string;
  record?: { id?: string; status?: string };
};

async function sendExpoPushForGoalRequest(
  supabaseUrl: string,
  serviceKey: string,
  goalRequestId: string
): Promise<{ sent: number; expo: unknown }> {
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: row, error: rowErr } = await admin
    .from('goal_requests')
    .select('id, profile_id, title, status')
    .eq('id', goalRequestId)
    .maybeSingle();

  if (rowErr || !row || row.status !== 'pending') {
    throw new Error('invalid_goal_request');
  }

  const { data: childRow, error: cErr } = await admin
    .from('child_profiles')
    .select('family_id, name')
    .eq('id', row.profile_id)
    .maybeSingle();

  if (cErr || !childRow) {
    throw new Error('profile_not_found');
  }

  const reqTitle = (row.title ?? 'Target').trim() || 'Target';
  const childName = childRow.name ?? 'Anak';

  const { data: parents } = await admin
    .from('accounts')
    .select('id')
    .eq('family_id', childRow.family_id)
    .in('role', ['primary_parent', 'secondary_parent']);

  const parentIds = (parents ?? []).map((p: { id: string }) => p.id);
  if (parentIds.length === 0) {
    return { sent: 0, expo: { data: [] } };
  }

  const { data: tokenRows } = await admin
    .from('account_push_tokens')
    .select('expo_push_token')
    .in('account_id', parentIds);

  const tokens = [
    ...new Set(
      (tokenRows ?? []).map((r: { expo_push_token: string }) => r.expo_push_token).filter(Boolean)
    ),
  ];
  if (tokens.length === 0) {
    return { sent: 0, expo: { reason: 'no_tokens' } };
  }

  const title = 'Pengajuan target menunggu tinjauan';
  const body = `${childName}: ${reqTitle}`;

  const messages = tokens.map((to: string) => ({
    to,
    sound: 'default' as const,
    title,
    body,
    data: {
      type: 'goal_request_pending',
      goalRequestId,
      profileId: row.profile_id,
    },
    channelId: 'task-review',
  }));

  const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  const expoJson = await expoRes.json();
  return { sent: tokens.length, expo: expoJson };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseAnon || !serviceKey) {
      return new Response(JSON.stringify({ error: 'server_misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const raw = (await req.json()) as JwtBody & WebhookPayload;
    let goalRequestId: string | undefined;

    const webhookSecret = Deno.env.get('TASK_PENDING_WEBHOOK_SECRET');
    const incomingSecret = req.headers.get('x-task-webhook-secret');
    if (webhookSecret && incomingSecret === webhookSecret) {
      if (raw.type === 'INSERT' && raw.table === 'goal_requests' && raw.record?.status === 'pending') {
        goalRequestId = raw.record.id;
      }
    } else {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'missing_auth' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const userClient = createClient(supabaseUrl, supabaseAnon, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: gr, error: grErr } = await userClient
        .from('goal_requests')
        .select('id, profile_id, status')
        .eq('id', String(raw.goal_request_id ?? '').trim())
        .maybeSingle();

      if (grErr || !gr || gr.status !== 'pending') {
        return new Response(JSON.stringify({ error: 'invalid_goal_request' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      goalRequestId = gr.id;
    }

    goalRequestId = goalRequestId?.trim();
    if (!goalRequestId) {
      return new Response(JSON.stringify({ error: 'goal_request_id_required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { sent, expo } = await sendExpoPushForGoalRequest(supabaseUrl, serviceKey, goalRequestId);
    return new Response(JSON.stringify({ ok: true, sent, expo }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = String(e);
    if (msg.includes('invalid_goal_request')) {
      return new Response(JSON.stringify({ error: 'invalid_goal_request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
