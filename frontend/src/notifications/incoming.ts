import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { isSoundName, type SoundName } from "./channels";
import { playNotificationSound } from "./soundPlayer";

// Android no permite cambiar el sonido de un canal ya creado.
// Por eso versionamos los IDs: si cambiamos la config, subimos el sufijo para forzar recreación.
export const ANDROID_SILENT_CHANNEL_ID = "xpress_silent_v2";

export function androidSoundChannelId(soundName: SoundName) {
  return `xpress_sound_${soundName}_v2`;
}

const LOCAL_MARKER_KEY = "__xpress_local";
const RECENT_TTL_MS = 30_000;
const MAX_RECENT = 200;

const recentEventIds = new Map<string, number>();

function nowMs() {
  return Date.now();
}

function cleanRecent() {
  const now = nowMs();
  for (const [key, ts] of recentEventIds.entries()) {
    if (now - ts > RECENT_TTL_MS) recentEventIds.delete(key);
  }
  if (recentEventIds.size <= MAX_RECENT) return;
  // Evita crecimiento sin límite: elimina los más antiguos.
  const entries = Array.from(recentEventIds.entries()).sort((a, b) => a[1] - b[1]);
  const toDelete = Math.max(0, entries.length - MAX_RECENT);
  for (let i = 0; i < toDelete; i++) recentEventIds.delete(entries[i]![0]);
}

function shouldProcessEventId(eventId: string | null): boolean {
  if (!eventId) return true;
  cleanRecent();
  const seenAt = recentEventIds.get(eventId);
  if (seenAt != null && nowMs() - seenAt <= RECENT_TTL_MS) return false;
  recentEventIds.set(eventId, nowMs());
  return true;
}

export function isLocalXpressNotification(data: any): boolean {
  return data && typeof data === "object" && String((data as any)[LOCAL_MARKER_KEY] ?? "") === "1";
}

export function ensureLocalMarker(data: Record<string, any> | undefined): Record<string, any> {
  return { ...(data ?? {}), [LOCAL_MARKER_KEY]: "1" };
}

export async function ensureAndroidSilentChannel() {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_SILENT_CHANNEL_ID, {
      name: "Xpress",
      // Queremos que aparezca en la barra/lista, sin heads-up y sin sonido.
      importance: Notifications.AndroidImportance.LOW,
      sound: null,
    });
  } catch {
    // best-effort
  }
}

export async function ensureAndroidSoundChannels() {
  if (Platform.OS !== "android") return;
  // Android usa el nombre del recurso en res/raw (sin extensión): R.raw.<soundFile>
  const items: Array<{ id: string; name: string; soundFile: string }> = [
    { id: androidSoundChannelId("disponibles"), name: "Xpress: disponibles", soundFile: "disponibles" },
    { id: androidSoundChannelId("aceptar_servicio"), name: "Xpress: aceptar servicio", soundFile: "aceptar_servicio" },
    { id: androidSoundChannelId("tienes_servicio"), name: "Xpress: tienes servicio", soundFile: "tienes_servicio" },
    { id: androidSoundChannelId("uber_llego"), name: "Xpress: uber llegó", soundFile: "uber_llego" },
  ];

  await Promise.all(
    items.map(async (c) => {
      try {
        await Notifications.setNotificationChannelAsync(c.id, {
          name: c.name,
          // Sonido sí, pero sin heads-up agresivo.
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: c.soundFile,
        });
      } catch {
        // best-effort
      }
    })
  );
}

function coerceObject(value: any): Record<string, any> | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) return null;
  return value as Record<string, any>;
}

function extractFromAny(input: any): {
  eventId: string | null;
  soundName: SoundName;
  title?: string;
  body?: string;
  data: Record<string, any>;
} | null {
  // Expo puede entregar diferentes formas de payload en background:
  // - { data: { ... } }
  // - { notification: { request: { content: { data }}}}
  // - Notification directo
  const candidates: any[] = [];
  candidates.push(input);

  const obj = coerceObject(input);
  if (obj) {
    if (obj.data) candidates.push(obj.data);
    if (obj.notification) candidates.push(obj.notification);
    if (obj.notification?.request?.content?.data) candidates.push(obj.notification.request.content.data);
    if (obj.request?.content?.data) candidates.push(obj.request.content.data);
  }

  for (const c of candidates) {
    const base = coerceObject(c);
    if (!base) continue;

    // Algunos wrappers meten el payload real en `data`.
    const nested = coerceObject((base as any).data);
    const d = nested ? { ...base, ...nested } : base;

    if (isLocalXpressNotification(d)) continue;

    const rawSoundName = typeof (d as any).soundName === "string" ? String((d as any).soundName).trim() : "";
    if (!isSoundName(rawSoundName)) continue;

    const eventId =
      typeof (d as any).eventId === "string" && String((d as any).eventId).trim() ? String((d as any).eventId).trim() : null;
    const title =
      typeof (d as any).title === "string" && String((d as any).title).trim() ? String((d as any).title).trim() : undefined;
    const body =
      (typeof (d as any).message === "string" && String((d as any).message).trim() ? String((d as any).message).trim() : undefined) ??
      (typeof (d as any).body === "string" && String((d as any).body).trim() ? String((d as any).body).trim() : undefined);

    return { eventId, soundName: rawSoundName, title, body, data: d };
  }

  return null;
}

function extractFromData(data: any) {
  return extractFromAny(data);
}

export async function presentSilentLocalNotification(params: {
  title?: string;
  body?: string;
  data?: Record<string, any>;
}) {
  if (Platform.OS !== "android") return;
  const title = params.title?.trim() ? params.title.trim() : undefined;
  const body = params.body?.trim() ? params.body.trim() : undefined;
  if (!title && !body) return;

  try {
    // Intento 1: inmediato.
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: ensureLocalMarker(params.data),
        android: { channelId: ANDROID_SILENT_CHANNEL_ID },
      } as any,
      trigger: null,
    });
  } catch {
    // Fallback: algunos entornos solo aplican channelId via trigger.
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: ensureLocalMarker(params.data),
        },
        trigger: { seconds: 1, channelId: ANDROID_SILENT_CHANNEL_ID } as any,
      });
    } catch {
      // best-effort
    }
  }
}

export async function presentSoundLocalNotification(params: {
  soundName: SoundName;
  title?: string;
  body?: string;
  data?: Record<string, any>;
}) {
  if (Platform.OS !== "android") return;
  const title = params.title?.trim() ? params.title.trim() : undefined;
  const body = params.body?.trim() ? params.body.trim() : undefined;
  if (!title && !body) return;

  try {
    const channelId = androidSoundChannelId(params.soundName);

    // Intento 1: inmediato.
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: ensureLocalMarker({ ...(params.data ?? {}), soundName: params.soundName }),
        android: { channelId },
      } as any,
      trigger: null,
    });
  } catch {
    // Fallback: channelId via trigger.
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: ensureLocalMarker({ ...(params.data ?? {}), soundName: params.soundName }),
        },
        trigger: { seconds: 1, channelId: androidSoundChannelId(params.soundName) } as any,
      });
    } catch {
      // best-effort
    }
  }
}

export async function handleIncomingSoundEventFromTask(taskData: any) {
  const extracted = extractFromAny(taskData);
  if (!extracted) return;
  if (!shouldProcessEventId(extracted.eventId)) return;

  // Background/minimizada: en Android el JS no puede garantizar audio in-app.
  // En su lugar, usamos un canal Android con MP3 nativo por evento.
  await presentSoundLocalNotification({
    soundName: extracted.soundName,
    title: extracted.title,
    body: extracted.body,
    data: extracted.data,
  });
}

export async function handleIncomingSoundEventFromNotification(notification: Notifications.Notification) {
  const content: any = notification?.request?.content ?? {};
  const extracted = extractFromAny(content?.data ?? content);
  if (!extracted) return;
  if (!shouldProcessEventId(extracted.eventId)) return;

  // Si ya llegó como Notification (por iOS/otro), no reprogramamos otra notificación.
  await playNotificationSound(extracted.soundName);
}

// Fallback para eventos detectados por polling/realtime (sin depender de push):
// muestra notificación local silenciosa (Android) y reproduce el MP3.
// Usa el mismo dedupe por `eventId` para evitar doble notificación/sonido.
export async function notifyAndPlayInAppOnce(params: {
  eventId: string;
  soundName: SoundName;
  title?: string;
  body?: string;
  data?: Record<string, any>;
}) {
  const eventId = params.eventId?.trim() ? params.eventId.trim() : "";
  if (!eventId) return;
  if (!shouldProcessEventId(eventId)) return;

  await presentSilentLocalNotification({
    title: params.title,
    body: params.body,
    data: { ...(params.data ?? {}), eventId, soundName: params.soundName },
  });

  await playNotificationSound(params.soundName);
}

// Fallback para eventos detectados por polling/realtime (sin depender de push):
// usa el mismo dedupe por `eventId` para evitar doble sonido.
export async function playInAppSoundOnce(params: { eventId: string; soundName: SoundName }) {
  const eventId = params.eventId?.trim() ? params.eventId.trim() : "";
  if (!eventId) return;
  if (!shouldProcessEventId(eventId)) return;
  await playNotificationSound(params.soundName);
}
