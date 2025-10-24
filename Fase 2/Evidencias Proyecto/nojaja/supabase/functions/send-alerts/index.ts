// supabase/functions/send-alerts/index.ts
// deno-lint-ignore-file
import { createClient } from "@supabase/supabase-js";
import { SignJWT, importPKCS8 } from "jose";

/** --- Supabase (service role), usando schema 'petcare' --- **/
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { db: { schema: "petcare" } }
);

/** --- Email via Resend --- **/
async function sendEmail(to: string, subject: string, text: string, html?: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MAIL_FROM") || "PetCare Pro <no-reply@updates.petcarepro.life>";
  if (!key) {
    console.log("[email] RESEND_API_KEY no configurado, skip");
    return false;
  }

  const payload: Record<string, unknown> = {
    from,
    to,
    subject,
    text: text || "",
  };
  if (html) payload.html = html;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.text();
  console.log("[email] Resend:", res.status, body);
  return res.ok;
}

/** --- Mini template opcional para que el correo se vea lindo --- **/
function buildEmailHTML(title: string, body: string) {
  const safeTitle = title || "Recordatorio PetCare";
  const safeBody = (body || "Toca para marcar como realizada.").replace(/\n/g, "<br />");
  return `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding:24px; color:#111">
      <h2 style="margin:0 0 8px 0;">${safeTitle}</h2>
      <p style="margin:0 0 16px 0; line-height:1.5;">${safeBody}</p>
      <p style="margin-top:24px; font-size:12px; color:#555">Enviado por PetCare Pro</p>
    </div>
  `;
}

/** --- Core --- **/
Deno.serve(async (req) => {
  // Opcional: si envías un header x-cron-key, se valida. Si no, se deja pasar.
  const secret = Deno.env.get("CRON_SECRET");
  const hasHeader = req.headers.has("x-cron-key");
  if (hasHeader && secret && req.headers.get("x-cron-key") !== secret) {
    return new Response("forbidden", { status: 403 });
  }

  const nowIso = new Date().toISOString();

  // 1) Traer alertas vencidas y pendientes
  const { data: due, error } = await supabase
    .from("alert")
    .select("alert_id,user_id,pet_id,title,body,channels,scheduled_at,status_id")
    .eq("status_id", "scheduled")
    .lte("scheduled_at", nowIso)
    .limit(500);

  if (error) {
    console.error("[send-alerts] select error:", error.message);
    return new Response(error.message, { status: 500 });
  }
  if (!due || due.length === 0) {
    console.log("send-alerts:due 0");
    return new Response("no-due");
  }

  console.log("processing:", due.map(d => d.alert_id).join(", ") || due.length);

  for (const a of due) {
    try {
      // 2) Obtener email del usuario (tabla app_user tiene email)
      const { data: userRow, error: uerr } = await supabase
        .from("app_user")
        .select("email, full_name")
        .eq("user_id", a.user_id)
        .maybeSingle();

      if (uerr) throw uerr;
      const email = userRow?.email || null;

      // 3) Enviar solo si el canal email está activo y tenemos correo
      const wantsEmail = Array.isArray(a.channels) && a.channels.includes("email");
      if (wantsEmail && email) {
        const title = a.title || "Recordatorio PetCare";
        const text = a.body || "Toca para marcar como realizada.";
        const html = buildEmailHTML(title, text);
        const ok = await sendEmail(email, title, text, html);
        if (!ok) throw new Error("Resend error (ver logs)");
      } else {
        console.log(`[skip] alert ${a.alert_id}: channel email no presente o sin email`);
      }

      // 4) Marcar como 'sent'
      const { error: upErr } = await supabase
        .from("alert")
        .update({ status_id: "sent", sent_at: new Date().toISOString() })
        .eq("alert_id", a.alert_id);
      if (upErr) throw upErr;

      console.log("marked sent:", a.alert_id);
    } catch (e) {
      console.error("dispatch failed:", a.alert_id, e?.message || e);
      // Si quieres marcar como 'failed' para no reintentar, descomenta:
      // await supabase.from("alert").update({ status_id: "failed" }).eq("alert_id", a.alert_id);
    }
  }

  return new Response("ok");
});
