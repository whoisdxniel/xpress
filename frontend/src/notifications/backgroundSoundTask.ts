import * as TaskManager from "expo-task-manager";
import type { SoundName } from "./channels";
import { playNotificationSound } from "./soundPlayer";

export const BACKGROUND_NOTIFICATION_TASK = "BACKGROUND_NOTIFICATION_TASK";

function extractSoundName(taskData: any): string {
  // `taskData` en Android viene desde RemoteMessageSerializer.toBundle(remoteMessage)
  // => { data: { soundName, ... }, notification: {...}, ... }
  const data = taskData?.data ?? {};
  const soundName = typeof data.soundName === "string" ? data.soundName.trim() : "";
  if (soundName) return soundName;

  // fallback: algunas cargas pueden venir en notification.sound
  const notif = taskData?.notification ?? {};
  const sound2 = typeof notif.sound === "string" ? notif.sound.trim() : "";
  return sound2;
}

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) return;
  const raw = extractSoundName(data);
  if (!raw) return;

  const name = raw as SoundName;
  // Best-effort: si viene un valor desconocido, no hacemos nada.
  if (!(["tienes_servicio", "aceptar_servicio", "uber_llego", "disponibles"] as const).includes(name as any)) {
    return;
  }

  await playNotificationSound(name);
});
