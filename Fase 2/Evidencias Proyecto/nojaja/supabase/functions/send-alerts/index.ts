// deno-lint-ignore-file
// supabase/functions/send-alerts/index.ts
import { createClient } from "@supabase/supabase-js"
import { SignJWT, importPKCS8 } from "jose";

// Cliente server-side (Service Role) en schema petcare
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { db: { schema: "petcare" } }
);

// ---------- helpers de canal ----------

async function sendEmail(to: string, subject: string, text: string) {
  const key = Deno.env.get("RESEND_API_KEY"); // o SENDGRID/MAILGUN
  if (!key) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "PetCare <onboarding@resend.dev>", to, subject, text })
  });
}

async function sendSms(e164: string, text: string) {
  const sid = Deno.env.get("TWILIO_SID");
  const token = Deno.env.get("TWILIO_TOKEN");
  const from = Deno.env.get("TWILIO_FROM"); // E.164
  if (!sid || !token || !from) return;
  const body = new URLSearchParams({ To: e164, From: from, Body: text });
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${sid}:${token}`) },
    body
  });
}

// ---- FCM v1 (Service Account JSON en FIREBASE_SERVICE_ACCOUNT) ----
type SA = { project_id: string; client_email: string; private_key: string };

async function getFcmAccessToken(sa: SA) {
  const now = Math.floor(Date.now() / 1000);
  const pk = await importPKCS8(sa.private_key, "RS256");
  const jwt = await new SignJWT({
    iss: sa.client_email,
    sub: sa.client_email,
    aud: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    iat: now,
    exp: now + 3600
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .sign(pk);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    }).toString()
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`OAuth token error: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

async function sendPushV1(token: string, title: string, body: string) {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!raw) return; // si no está configurado, omite push
  const sa: SA = JSON.parse(raw);
  const accessToken = await getFcmAccessToken(sa);
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  const payload = {
    message: {
      token,
      notification: { title, body },
      data: { source: "petcare", kind: "alert" }
    }
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`FCM v1 error: ${err}`);
  }
}

// ---------- core ----------
Deno.serve(async (req) => {
  // Check opcional: permite scheduler (sin header) y protege curl manual
  const secret = Deno.env.get("CRON_SECRET");
  const hasHeader = req.headers.has("x-cron-key");
  if (hasHeader && secret && req.headers.get("x-cron-key") !== secret) {
    return new Response("forbidden", { status: 403 });
  }

  const nowIso = new Date().toISOString();

  // 1) Trae alertas vencidas
  const { data: due, error } = await supabase
    .from("alert")
    .select("alert_id,user_id,title,body,channels,scheduled_at,status_id,pet_id")
    .eq("status_id", "scheduled")
    .lte("scheduled_at", nowIso)
    .limit(500);

  if (error) return new Response(error.message, { status: 500 });
  if (!due || due.length === 0) return new Response("no-due");

  for (const a of due) {
    // 2) Datos del usuario (email + phone en user_pii)
    const [{ data: user }, { data: pii }] = await Promise.all([
      supabase.from("app_user")
        .select("email, full_name")
        .eq("user_id", a.user_id)
        .single(),
      supabase.from("user_pii")
        .select("phone")
        .eq("user_id", a.user_id)
        .single(),
    ]);

    const email_w = user?.email ?? null;
    const phone_w = pii?.phone ?? null;
    const title = a.title ?? "Recordatorio PetCare";
    const body  = a.body  ?? "Toca para marcar como realizada.";

    try {
      if (a.channels.includes("email") && email_w) {
        await sendEmail(email_w, title, body);
      }
      if (a.channels.includes("sms") && phone_w) {
        await sendSms(phone_w, `${title}: ${body}`);
      }
      if (a.channels.includes("push")) {
        const { data: tokens } = await supabase
          .from("user_device")
          .select("fcm_token")
          .eq("user_id", a.user_id)
          .eq("is_active", true);

        for (const t of tokens ?? []) {
          await sendPushV1(t.fcm_token, title, body);
        }
      }

      // 4) Marca como enviada
      await supabase
        .from("alert")
        .update({ status_id: "sent", sent_at: new Date().toISOString() })
        .eq("alert_id", a.alert_id);
    } catch (e) {
      console.error("dispatch failed", a.alert_id, e);
      // TODO: insertar en petcare.alert_dispatch si decides llevar bitácora
    }
  }

  return new Response("ok");
});

