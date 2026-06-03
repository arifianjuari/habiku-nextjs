/**
 * Versi penuh (v1.0):
 * - Pemanggilan dari app (JWT Authorization) — body { task_history_id }.
 * - Pemanggilan dari Supabase Database Webhook (INSERT task_history) — set header
 *   `x-task-webhook-secret` sama dengan secret Edge `TASK_PENDING_WEBHOOK_SECRET`;
 *   body mengikuti payload webhook (field `record` berisi baris baru).
 *
 * Push memakai saluran Android `task-review` (daftar di klien: register-parent-push).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-task-webhook-secret',
};

type JwtBody = { task_history_id?: string };

type WebhookPayload = {
  type?: string;
  table?: string;
  record?: { id?: string; status?: string };
};

async function sendExpoPushForPendingTask(
  supabaseUrl: string,
  serviceKey: string,
  taskHistoryId: string
): Promise<{ sent: number; expo: unknown }> {
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: th, error: thErr } = await admin
    .from('task_history')
    .select('id, profile_id, task_id, status')
    .eq('id', taskHistoryId)
    .maybeSingle();

  if (thErr || !th || th.status !== 'pending') {
    throw new Error('invalid_task_history');
  }

  const { data: childRow, error: cErr } = await admin
    .from('child_profiles')
    .select('family_id, name')
    .eq('id', th.profile_id)
    .maybeSingle();

  if (cErr || !childRow) {
    throw new Error('profile_not_found');
  }

  const { data: taskRow } = await admin.from('tasks').select('title').eq('id', th.task_id).maybeSingle();

  const taskTitle = taskRow?.title ?? 'Misi';
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

  const tokens = [...new Set((tokenRows ?? []).map((r: { expo_push_token: string }) => r.expo_push_token).filter(Boolean))];
  if (tokens.length === 0) {
    return { sent: 0, expo: { reason: 'no_tokens' } };
  }

  const title = 'Misi menunggu tinjauan';
  const body = `${childName}: ${taskTitle}`;

  const messages = tokens.map((to: string) => ({
    to,
    sound: 'default',
    title,
    body,
    data: { taskHistoryId, type: 'task_pending_review' },
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
    let taskHistoryId: string | undefined;

    const webhookSecret = Deno.env.get('TASK_PENDING_WEBHOOK_SECRET');
    const incomingSecret = req.headers.get('x-task-webhook-secret');
    if (webhookSecret && incomingSecret === webhookSecret) {
      if (raw.type === 'INSERT' && raw.table === 'task_history' && raw.record?.status === 'pending') {
        taskHistoryId = raw.record.id;
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
      const { data: th, error: thErr } = await userClient
        .from('task_history')
        .select('id, profile_id, task_id, status')
        .eq('id', String(raw.task_history_id ?? '').trim())
        .maybeSingle();

      if (thErr || !th || th.status !== 'pending') {
        return new Response(JSON.stringify({ error: 'invalid_task_history' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      taskHistoryId = th.id;
    }

    taskHistoryId = taskHistoryId?.trim();
    if (!taskHistoryId) {
      return new Response(JSON.stringify({ error: 'task_history_id_required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { sent, expo } = await sendExpoPushForPendingTask(supabaseUrl, serviceKey, taskHistoryId);

    let webPush: unknown = { skipped: 'app_url_or_secret_missing' };
    const appUrl = Deno.env.get('APP_URL') ?? Deno.env.get('NEXT_PUBLIC_APP_URL');
    const internalSecret =
      Deno.env.get('TASK_PENDING_WEBHOOK_SECRET') ?? Deno.env.get('CRON_SECRET');
    if (appUrl && internalSecret) {
      try {
        const webRes = await fetch(
          `${appUrl.replace(/\/$/, '')}/api/internal/push/task-pending`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-task-webhook-secret': internalSecret,
            },
            body: JSON.stringify({ task_history_id: taskHistoryId }),
          },
        );
        webPush = await webRes.json();
      } catch (webErr) {
        webPush = { error: String(webErr) };
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, expo, webPush }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = String(e);
    if (msg.includes('invalid_task_history')) {
      return new Response(JSON.stringify({ error: 'invalid_task_history' }), {
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
