import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getAppUrl } from "@/lib/env";

type PushSubscriptionJson = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

function configureVapid(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const subject =
    process.env.WEB_PUSH_VAPID_SUBJECT ?? "mailto:habiku@vercel.app";

  if (!publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

function parseWebPushSubscription(raw: string): PushSubscriptionJson | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as PushSubscriptionJson;
    if (
      parsed?.endpoint &&
      parsed?.keys?.p256dh &&
      parsed?.keys?.auth
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function isExpoToken(raw: string): boolean {
  return (
    raw.startsWith("ExponentPushToken[") ||
    raw.startsWith("ExpoPushToken")
  );
}

export type TaskPendingPushResult = {
  sent: number;
  skipped: number;
  errors: string[];
};

export async function sendTaskPendingWebPush(
  taskHistoryId: string,
): Promise<TaskPendingPushResult> {
  const result: TaskPendingPushResult = { sent: 0, skipped: 0, errors: [] };

  if (!configureVapid()) {
    result.skipped += 1;
    result.errors.push("vapid_not_configured");
    return result;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    result.errors.push("supabase_service_role_missing");
    return result;
  }

  const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: th, error: thErr } = await admin
    .from("task_history")
    .select("id, profile_id, task_id, status")
    .eq("id", taskHistoryId)
    .maybeSingle();

  if (thErr || !th || th.status !== "pending") {
    result.errors.push("invalid_task_history");
    return result;
  }

  const { data: childRow } = await admin
    .from("child_profiles")
    .select("family_id, name")
    .eq("id", th.profile_id)
    .maybeSingle();

  if (!childRow?.family_id) {
    result.errors.push("profile_not_found");
    return result;
  }

  const { data: taskRow } = await admin
    .from("tasks")
    .select("title")
    .eq("id", th.task_id)
    .maybeSingle();

  const childName = childRow.name ?? "Anak";
  const taskTitle = taskRow?.title ?? "Misi";

  const { data: parents } = await admin
    .from("accounts")
    .select("id")
    .eq("family_id", childRow.family_id)
    .in("role", ["primary_parent", "secondary_parent"]);

  const parentIds = (parents ?? []).map((p) => p.id);
  if (parentIds.length === 0) {
    return result;
  }

  const { data: tokenRows } = await admin
    .from("account_push_tokens")
    .select("expo_push_token, platform")
    .in("account_id", parentIds);

  const appUrl = getAppUrl();
  const payload = JSON.stringify({
    title: "Misi menunggu tinjauan",
    body: `${childName}: ${taskTitle}`,
    url: `${appUrl}/parent/queue`,
    taskHistoryId,
    type: "task_pending_review",
  });

  const seen = new Set<string>();

  for (const row of tokenRows ?? []) {
    const raw = row.expo_push_token?.trim();
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);

    if (row.platform !== "web_pwa" && isExpoToken(raw)) {
      result.skipped += 1;
      continue;
    }

    const subscription = parseWebPushSubscription(raw);
    if (!subscription) {
      result.skipped += 1;
      continue;
    }

    try {
      await webpush.sendNotification(subscription, payload);
      result.sent += 1;
    } catch (err) {
      result.errors.push(String(err));
    }
  }

  return result;
}
