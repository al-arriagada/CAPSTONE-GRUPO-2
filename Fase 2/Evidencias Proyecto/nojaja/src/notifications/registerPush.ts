// src/notifications/registerPush.ts
import { getApps, getApp, initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, deleteToken } from "firebase/messaging";
import { supabase } from "../supabaseClient";

// Config de Firebase desde tus Vite envs (frontend)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FB_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};

function getFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

/**
 * Pide permiso de notificaciones, obtiene token FCM y lo guarda en petcare.user_device
 */
export async function registerPush(userId: string) {
  if (!userId) return;
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return;

  // Solicita permiso si no está concedido
  if (Notification.permission !== "granted") {
    const p = await Notification.requestPermission();
    if (p !== "granted") return;
  }

  // SW DEBE estar en /firebase-messaging-sw.js
  //const sw = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

  const app = getFirebaseApp();
  const messaging = getMessaging(app);

    const vapid = (import.meta.env.VITE_FB_VAPID_KEY || "").trim();
    console.log("[push] VAPID len =", vapid.length, "prefix =", vapid.slice(0, 12));

    const sw = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
    sw.update();

    const token = await getToken(messaging, {
    vapidKey: vapid,
    serviceWorkerRegistration: sw
    });
    console.log("[push] token =", token);

  if (token) {
    await supabase
    .schema("petcare")
    .from("user_device")
    .upsert(
      {
        user_id: userId,
        platform: "web",
        fcm_token: token,
        is_active: true,
      },
      { onConflict: "user_id,fcm_token" }
    );
  }

  // Notificación cuando la app está en foreground
  onMessage(messaging, (payload) => {
    const n = payload.notification;
    if (n) new Notification(n.title || "PetCare", { body: n.body || "" });
  });
}

/**
 * Borra el token FCM de este navegador y lo elimina de petcare.user_device
 */
export async function unregisterPush(userId: string) {
  try {
    if (!("serviceWorker" in navigator)) return;

    const app = getFirebaseApp();
    const messaging = getMessaging(app);
    const sw = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
    if (!sw) return;

    // Intenta recuperar el token actual para borrarlo también del backend
    const currentToken = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FB_VAPID_KEY,
      serviceWorkerRegistration: sw,
    });

    // Borra el token del navegador
    await deleteToken(messaging);

    // Y del backend (si lo teníamos)
    if (currentToken && userId) {
      await supabase
        .from("user_device")
        .delete()
        .eq("user_id", userId)
        .eq("fcm_token", currentToken);
    }
  } catch (e) {
    // no romper el logout por esto
    console.warn("unregisterPush:", (e as any)?.message || e);
  }
}
