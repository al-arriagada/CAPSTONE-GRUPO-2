// /public/firebase-messaging-sw.js
/* eslint-env serviceworker */
/* global importScripts, firebase */
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

//const senderId = import.meta.env.VITE_FB_SENDER_ID


// SOLO necesita el senderId aquí (número)
firebase.initializeApp({
  apiKey: "VITE_FB_API_KEY",
  authDomain: "VITE_FB_AUTH_DOMAIN",
  projectId: "VITE_FB_PROJECT_ID",
  messagingSenderId: "VITE_FB_SENDER_ID",   // número
  appId: "VITE_FB_APP_ID",
  // measurementId: "G-XXXXXXX"
});

const messaging = firebase.messaging();

// Muestra la notificación cuando la app está cerrada/en 2º plano
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  self.registration.showNotification(n.title || "PetCare", {
    body: n.body || "",
    icon: "/icon-192.png" // opcional si tienes un icono
  });
});
