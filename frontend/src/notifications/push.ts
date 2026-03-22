import Constants from "expo-constants";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { SoundName } from "./channels";
import { playNotificationSound } from "./soundPlayer";
import { BACKGROUND_NOTIFICATION_TASK } from "./backgroundSoundTask";

let handlerInstalled = false;
let inAppSoundInstalled = false;
let backgroundTaskRegistered = false;

export const ANDROID_DEFAULT_CHANNEL_ID = "xpress_default_v1";

function isExpoGo() {
  const executionEnvironment = (Constants as any)?.executionEnvironment;
  if (executionEnvironment != null) return executionEnvironment === "storeClient";

  // Fallback para versiones viejas de expo-constants.
  const appOwnership = (Constants as any)?.appOwnership;
  return appOwnership === "expo";
}

export function setupNotificationHandlerOnce() {
  if (handlerInstalled) return;
  handlerInstalled = true;

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      return {
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      };
    },
  });
}

export function setupInAppSoundOnce() {
  if (inAppSoundInstalled) return;
  inAppSoundInstalled = true;

  // Cuando la app está viva (foreground o en algunos casos background),
  // reproducimos el sonido custom además del sonido del sistema.
  Notifications.addNotificationReceivedListener((notification) => {
    try {
      const data: any = (notification.request?.content?.data ?? {}) as any;
      const raw = typeof data.soundName === "string" ? data.soundName.trim() : "";
      if (!raw) return;

      const name = raw as SoundName;
      if (!(["tienes_servicio", "aceptar_servicio", "uber_llego", "disponibles"] as const).includes(name as any)) {
        return;
      }

      void playNotificationSound(name);
    } catch {
      // silencioso
    }
  });
}

export async function registerBackgroundNotificationTaskOnce() {
  if (backgroundTaskRegistered) return;
  backgroundTaskRegistered = true;

  // Desde Expo SDK 53, Expo Go no soporta push remoto.
  if (Platform.OS !== "android" && Platform.OS !== "ios") return;
  if (isExpoGo()) return;

  try {
    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
  } catch {
    // Si TaskManager no está disponible en algún build, no rompemos la app.
  }
}

export async function ensureAndroidChannels() {
  if (Platform.OS !== "android") return;

  async function safeDeleteChannel(id: string) {
    try {
      await Notifications.deleteNotificationChannelAsync(id);
    } catch {
      // best-effort
    }
  }

  // Limpieza: evita que MIUI acumule categorías duplicadas.
  // Ahora usamos 1 solo canal default y el sonido custom lo reproducimos en la app.
  await Promise.all(
    [
      // legacy
      "tienes_servicio",
      "aceptar_servicio",
      "uber_llego",
      "disponibles",
      // v2
      "tienes_servicio_v2",
      "aceptar_servicio_v2",
      "uber_llego_v2",
      "disponibles_v2",
      // v3
      "tienes_servicio_v3",
      "aceptar_servicio_v3",
      "uber_llego_v3",
      "disponibles_v3",
      // fallbacks anteriores que creamos
      "xpress_fallback_v1",
      // canal default
      ANDROID_DEFAULT_CHANNEL_ID,
    ].map(safeDeleteChannel)
  );

  // Un único canal para que el sistema use el sonido default del teléfono.
  // (El MP3 específico se reproduce desde JS en foreground/background.)
  await Notifications.setNotificationChannelAsync(ANDROID_DEFAULT_CHANNEL_ID, {
    name: "Xpress",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
  });
}

export async function getNativePushToken() {
  // Desde Expo SDK 53, Expo Go ya no soporta push remoto.
  // Para testear push, usar un development build (EAS dev client) o standalone.
  if (Platform.OS === "web" || isExpoGo()) return null;

  const settings = await Notifications.getPermissionsAsync();
  const granted = settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  if (!granted) {
    const req =
      Platform.OS === "ios"
        ? await Notifications.requestPermissionsAsync({
            ios: { allowAlert: true, allowSound: true, allowBadge: false },
          })
        : await Notifications.requestPermissionsAsync();

    const ok = req.granted || req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    if (!ok) return null;
  }

  const tokenRes = await Notifications.getDevicePushTokenAsync();
  const platform = Platform.OS === "ios" ? ("IOS" as const) : ("ANDROID" as const);

  return { token: tokenRes.data, platform };
}
