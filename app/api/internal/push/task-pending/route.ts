import { NextRequest, NextResponse } from "next/server";
import { sendTaskPendingWebPush } from "@/lib/push/send-task-pending-web-push";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const webhookSecret = process.env.TASK_PENDING_WEBHOOK_SECRET?.trim();
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const headerSecret = request.headers.get("x-task-webhook-secret")?.trim() ?? "";

  return Boolean(
    (cronSecret && bearer === cronSecret) ||
      (webhookSecret && headerSecret === webhookSecret),
  );
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Akses tidak sah." }, { status: 401 });
  }

  let taskHistoryId: string | undefined;
  try {
    const body = (await request.json()) as { task_history_id?: string };
    taskHistoryId = body.task_history_id?.trim();
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  if (!taskHistoryId) {
    return NextResponse.json(
      { error: "task_history_id wajib diisi." },
      { status: 400 },
    );
  }

  const result = await sendTaskPendingWebPush(taskHistoryId);
  return NextResponse.json({ ok: true, ...result });
}
