// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// supabase/functions/send-alerts/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // para bypass RLS
);

// --- helpers de canal ---
async function sendEmail(to: string, subject: string, text: string) {
  const key = Deno.env.get("RESEND_API_KEY"); // o SENDGRID_API_KEY/MAILGUN
  if (!key) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "PetCare <noti@tudominio.cl>", to, subject, text })
  });
}

async function sendSms(e164: string, text: string) {
  const sid = Deno.env.get("TWILIO_SID");
  const token = Deno.env.get("TWILIO_TOKEN");
  const from = Deno.env.get("TWILIO_FROM"); // +1...
  if (!sid || !token || !from) return;
  const body = new URLSearchParams({ To: e164, From: from, Body: text });
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { "Authorization": "Basic " + btoa(`${sid}:${token}`) },
    body
  });
}

async function sendPush(token: string, title: string, body: string) {
  const key = Deno.env.get("FCM_SERVER_KEY");
  if (!key) return;
  await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: { "Authorization": `key=${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      to: token,
      notification: { title, body },
      data: { source: "petcare", kind: "alert" }
    })
  });
}

// --- core ---
Deno.serve(async (req) => {
  // Protección simple para invocación manual
  const secret = Deno.env.get("CRON_SECRET");
  if (secret && req.headers.get("x-cron-key") !== secret) {
    return new Response("forbidden", { status: 403 });
  }

  const nowIso = new Date().toISOString();

  // 1) Trae alertas vencidas
  const { data: due, error } = await supabase
    .from("petcare.alert")
    .select("alert_id,user_id,title,body,channels,scheduled_at,status_id,pet_id")
    .eq("status_id", "scheduled")
    .lte("scheduled_at", nowIso)
    .limit(500);

  if (error) return new Response(error.message, { status: 500 });
  if (!due || due.length === 0) return new Response("no-due");

  for (const a of due) {
    // 2) Carga datos del usuario
    const [{ data: user }, { data: pii }] = await Promise.all([
      supabase.from("petcare.app_user")
        .select("email, full_name")
        .eq("user_id", a.user_id)
        .single(),
      supabase.from("petcare.user_pii")
        .select("phone")
        .eq("user_id", a.user_id)
        .single(),
    ]);
    
    // 3) Dispara por los canales solicitados
    const email_w = user?.email ?? null;
    const phone_w = pii?.phone ?? null; 
    const title = a.title ?? "Recordatorio PetCare";
    const body  = a.body  ?? "Toca para marcar como realizada.";

    try {
      if (a.channels.includes("email") && email_w) {
        await sendEmail(user.email, title, body);
      }
      if (a.channels.includes("sms") && phone_w) {
        await sendSms(user.phone, `${title}: ${body}`);
      }
      if (a.channels.includes("push")) {
        const { data: tokens } = await supabase
          .from("petcare.user_device")
          .select("fcm_token")
          .eq("user_id", a.user_id)
          .eq("is_active", true);

        for (const t of tokens ?? []) await sendPush(t.fcm_token, title, body);
      }

      // 4) Marca como enviada
      await supabase
        .from("petcare.alert")
        .update({ status_id: "sent", sent_at: new Date().toISOString() })
        .eq("alert_id", a.alert_id);
    } catch (e) {
      console.error("dispatch failed", a.alert_id, e);
      // Si quieres, registra un log en petcare.alert_dispatch aquí
    }
  }

  return new Response("ok");
});

