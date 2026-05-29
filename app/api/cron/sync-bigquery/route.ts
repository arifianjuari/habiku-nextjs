import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * Endpoint Cron Harian: Sinkronisasi tabel point_ledger & task_history ke Google BigQuery.
 * Menggunakan Streaming Buffer REST API resmi Google Cloud.
 */
export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}

async function handleSync(request: NextRequest) {
  try {
    // 1. Validasi Token Keamanan CRON_SECRET
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn("⚠️ Upaya sinkronisasi BigQuery tidak sah dicegah.");
      return NextResponse.json({ error: "Akses tidak sah." }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Konfigurasi kredensial layanan Supabase belum lengkap." },
        { status: 500 }
      );
    }

    // Inisialisasi Supabase Service Client (Bypass RLS untuk sinkronisasi analitik)
    const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    console.log("[BigQuery Sync] Memulai query data baru dari Supabase...");

    // 2. Fetch data point_ledger baru (misal 24 jam terakhir)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: ledgerData, error: ledgerError } = await supabase
      .from("point_ledger")
      .select("*")
      .gte("created_at", oneDayAgo);

    if (ledgerError) throw ledgerError;

    // 3. Fetch data task_history baru
    const { data: historyData, error: historyError } = await supabase
      .from("task_history")
      .select("*")
      .gte("created_at", oneDayAgo);

    if (historyError) throw historyError;

    const ledgerCount = ledgerData?.length || 0;
    const historyCount = historyData?.length || 0;

    // 4. Integrasi Streaming Insert Google BigQuery
    const gcpProjectId = process.env.GCP_PROJECT_ID;
    const gcpClientEmail = process.env.GCP_CLIENT_EMAIL;
    const gcpPrivateKey = process.env.GCP_PRIVATE_KEY;
    const bqDatasetId = process.env.BIGQUERY_DATASET_ID || "habiku_analytics";

    const hasGcpConfig = gcpProjectId && gcpClientEmail && gcpPrivateKey;

    if (!hasGcpConfig) {
      console.warn(
        "⚠️ GCP Credentials tidak lengkap di .env.local. Berjalan dalam FALLBACK MODE (Simulasi)..."
      );

      return NextResponse.json({
        success: true,
        mode: "simulation",
        message: "Simulasi sinkronisasi BigQuery berhasil dijalankan.",
        synced_records: {
          point_ledger: ledgerCount,
          task_history: historyCount,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // JALUR NYATA: Sinkronisasi ke Google BigQuery (Streaming Inserts)
    console.log(
      `[BigQuery Sync] Menyinkronkan ${ledgerCount} data ledger & ${historyCount} data riwayat ke BigQuery...`
    );

    // Keterangan: Pembuatan JWT Token & streaming REST API Google Cloud
    const accessToken = await getGoogleOAuthToken(gcpClientEmail, gcpPrivateKey);

    // Kirim data point_ledger
    if (ledgerCount > 0) {
      await streamToBigQuery(
        gcpProjectId,
        bqDatasetId,
        "point_ledger",
        ledgerData.map((item) => ({
          insertId: item.id,
          json: {
            id: item.id,
            profile_id: item.profile_id,
            account_id: item.account_id,
            amount: item.amount,
            type: item.type,
            task_history_id: item.task_history_id,
            created_at: item.created_at,
          },
        })),
        accessToken
      );
    }

    // Kirim data task_history
    if (historyCount > 0) {
      await streamToBigQuery(
        gcpProjectId,
        bqDatasetId,
        "task_history",
        historyData.map((item) => ({
          insertId: item.id,
          json: {
            id: item.id,
            task_id: item.task_id,
            profile_id: item.profile_id,
            status: item.status,
            evidence_url: item.evidence_url,
            notes: item.notes,
            completed_at: item.completed_at,
            period_date: item.period_date,
            created_at: item.created_at,
          },
        })),
        accessToken
      );
    }

    return NextResponse.json({
      success: true,
      mode: "production",
      message: "Sinkronisasi riwayat analitik BigQuery berhasil diselesaikan secara nyata.",
      synced_records: {
        point_ledger: ledgerCount,
        task_history: historyCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("❌ Gagal menyelesaikan sinkronisasi BigQuery:", err);
    return NextResponse.json(
      { error: err.message || "Terjadi kesalahan internal sinkronisasi." },
      { status: 500 }
    );
  }
}

/**
 * Menghasilkan Token Akses OAuth 2.0 Google menggunakan Kunci Privat Service Account.
 */
async function getGoogleOAuthToken(email: string, privateKey: string): Promise<string> {
  const cleanKey = privateKey.replace(/\\n/g, "\n");
  
  // Header JWT
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  // Payload JWT
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: email,
    scope: "https://www.googleapis.com/auth/bigquery",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  // Dalam Route Handler Next.js, kita bisa menggunakan standard crypto Node.js untuk sign JWT.
  const crypto = await import("crypto");
  
  const base64Header = Buffer.from(JSON.stringify(header)).toString("base64url");
  const base64Claim = Buffer.from(JSON.stringify(claim)).toString("base64url");
  
  const signatureInput = `${base64Header}.${base64Claim}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signatureInput);
  
  const signature = signer.sign(cleanKey, "base64url");
  const jwt = `${signatureInput}.${signature}`;

  // Kirim POST ke OAuth endpoint
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google OAuth token exchange failed: ${errText}`);
  }

  const resJson = await response.json();
  return resJson.access_token;
}

/**
 * Mengirim records ke endpoint Streaming Insert BigQuery.
 */
async function streamToBigQuery(
  projectId: string,
  datasetId: string,
  tableId: string,
  rows: Array<{ insertId: string; json: Record<string, any> }>,
  accessToken: string
) {
  const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/datasets/${datasetId}/tables/${tableId}/insertAll`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      kind: "bigquery#tableDataInsertAllRequest",
      skipInvalidRows: false,
      ignoreUnknownValues: false,
      rows,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`BigQuery stream to ${tableId} failed: ${errText}`);
  }

  const result = await response.json();
  if (result.insertErrors && result.insertErrors.length > 0) {
    console.error(`BigQuery stream errors on table ${tableId}:`, JSON.stringify(result.insertErrors));
    throw new Error(`BigQuery stream failed due to row insertion errors on table ${tableId}.`);
  }
}
