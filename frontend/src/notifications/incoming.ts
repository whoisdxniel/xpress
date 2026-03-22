import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { isSoundName, type SoundName } from "./channels";
import { playNotificationSound } from "./soundPlayer";

export const ANDROID_SILENT_CHANNEL_ID = "xpress_silent_v1";

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
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: null,
    });
  } catch {
    // best-effort
  }
}

function shouldPresentAndroidSilentNotification(soundName: SoundName): boolean {
  // Según el requerimiento: casos 3 y 4 llevan notificación + sonido in-app.
  // Casos 1 y 2 deben ser “en la app” (sin ensuciar la barra de notificaciones).
  return soundName === "tienes_servicio" || soundName === "uber_llego";
}

function extractFromData(data: any): {
  eventId: string | null;
  soundName: SoundName;
  title?: string;
  body?: string;
  data: Record<string, any>;
} | null {
  const d = (data ?? {}) as any;
  if (isLocalXpressNotification(d)) return null;

  const rawSoundName = typeof d.soundName === "string" ? d.soundName.trim() : "";
  if (!isSoundName(rawSoundName)) return null;

  const eventId = typeof d.eventId === "string" && d.eventId.trim() ? d.eventId.trim() : null;
  const title = typeof d.title === "string" && d.title.trim() ? d.title.trim() : undefined;
  const body = typeof d.message === "string" && d.message.trim() ? d.message.trim() : undefined;

  return { eventId, soundName: rawSoundName, title, body, data: d };
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
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: ensureLocalMarker(params.data),
      },
      trigger: { channelId: ANDROID_SILENT_CHANNEL_ID },
    });
  } catch {
    // best-effort
  }
}

export async function handleIncomingSoundEventFromTask(taskData: any) {
  const extracted = extractFromData(taskData?.data);
  if (!extracted) return;
  if (!shouldProcessEventId(extracted.eventId)) return;

  // En Android: sólo algunos eventos deben mostrarse como notificación.
  if (Platform.OS === "android" && shouldPresentAndroidSilentNotification(extracted.soundName)) {
    await presentSilentLocalNotification({
      title: extracted.title,
      body: extracted.body,
      data: extracted.data,
    });
  }

  await playNotificationSound(extracted.soundName);
}

export async function handleIncomingSoundEventFromNotification(notification: Notifications.Notification) {
  const content: any = notification?.request?.content ?? {};
  const extracted = extractFromData(content?.data);
  if (!extracted) return;
  if (!shouldProcessEventId(extracted.eventId)) return;

  // Si ya llegó como Notification (por iOS/otro), no reprogramamos otra notificación.
  await playNotificationSound(extracted.soundName);
}
