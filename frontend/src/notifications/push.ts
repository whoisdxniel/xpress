import Constants from "expo-constants";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { channelIdForSound, normalizeChannelId, type SoundName } from "./channels";

let handlerInstalled = false;
let foregroundFixInstalled = false;

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
      const data: any = (notification.request?.content?.data ?? {}) as any;
      const soundName = typeof data.soundName === "string" ? data.soundName.trim() : "";
      const isLocalFix = String(data.__localSoundFix ?? "") === "1";

      // Si viene sonido custom en data y NO es la notificación local que presentamos,
      // suprimimos el banner/sound del remoto para evitar duplicado.
      const interceptRemote = !!soundName && !isLocalFix;

      return {
        shouldShowAlert: !interceptRemote,
        shouldShowBanner: !interceptRemote,
        shouldShowList: !interceptRemote,
        shouldPlaySound: !interceptRemote,
        shouldSetBadge: false,
      };
    },
  });
}

export function setupForegroundSoundFixOnce() {
  if (foregroundFixInstalled) return;
  foregroundFixInstalled = true;

  Notifications.addNotificationReceivedListener((notification) => {
    try {
      const content = notification.request?.content;
      const data: any = (content?.data ?? {}) as any;
      if (String(data.__localSoundFix ?? "") === "1") return;

      const soundName = typeof data.soundName === "string" ? data.soundName.trim() : "";
      if (!soundName) return;

      const normalizedSound = soundName as SoundName;
      const channelId = normalizeChannelId(data.channelId, normalizedSound) || channelIdForSound(normalizedSound);

      const nextData: Record<string, any> = { ...data, __localSoundFix: "1" };
      delete (nextData as any).soundName;
      delete (nextData as any).channelId;

      void Notifications.scheduleNotificationAsync({
        content: {
          title: content?.title ?? "",
          body: content?.body ?? "",
          data: nextData,
          ...(Platform.OS === "android" ? { channelId } : null),
          ...(Platform.OS === "ios" ? { sound: `${normalizedSound}.mp3` } : null),
        },
        trigger: null,
      });
    } catch {
      // silencioso
    }
  });
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

  // Nota: NO borramos en masa canales v2/legacy porque pueden estar siendo usados
  // por backends viejos. En vez de eso, los reparamos idempotentemente más abajo.

  async function ensureChannel(params: {
    id: string;
    name: string;
    sound: SoundName;
  }) {
    const desiredSound = params.sound;

    const isDefaultish = (raw: unknown) => {
      const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
      return !s || s === "default" || s === "none";
    };

    const matchesDesired = (raw: unknown) => {
      const s = typeof raw === "string" ? raw.trim() : "";
      if (!s) return false;
      if (s === desiredSound) return true;
      if (s === `${desiredSound}.mp3`) return true;
      return false;
    };

    // Si el canal ya existe pero su sonido quedó en default/none, Android no permite cambiarlo.
    // En ese caso, borramos y recreamos.
    try {
      const existing = await Notifications.getNotificationChannelAsync(params.id);
      const existingSound = (existing as any)?.sound;
      if (existing && !matchesDesired(existingSound)) {
        // Si está en default/none o es otro sonido, borramos y recreamos.
        await safeDeleteChannel(params.id);
      }
    } catch {
      // best-effort
    }

    const createWithSound = async (sound: string) => {
      await Notifications.setNotificationChannelAsync(params.id, {
        name: params.name,
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.NOTIFICATION,
          contentType: (Notifications as any).AndroidAudioContentType?.SONIFICATION,
        },
        sound,
      });
    };

    // 1) Intento estándar (sin extensión)
    await createWithSound(desiredSound);

    // 2) Verificación + fallback (algunos OEM requieren "archivo.mp3")
    try {
      const after = await Notifications.getNotificationChannelAsync(params.id);
      const afterSound = (after as any)?.sound;
      if (after && (isDefaultish(afterSound) || !matchesDesired(afterSound))) {
        await safeDeleteChannel(params.id);
        await createWithSound(`${desiredSound}.mp3`);
      }
    } catch {
      // best-effort
    }
  }

  // Creamos/repamos múltiples ids por compatibilidad:
  // - legacy (sin sufijo)
  // - v2 (backends anteriores)
  // - v3 (actual)
  const variantsFor = (sound: SoundName) => {
    const legacy = sound;
    const v2 = `${sound}_v2`;
    const v3 = channelIdForSound(sound);
    return [legacy, v2, v3];
  };

  for (const id of variantsFor("tienes_servicio")) {
    await ensureChannel({ id, name: "Servicios por aceptar", sound: "tienes_servicio" });
  }
  for (const id of variantsFor("aceptar_servicio")) {
    await ensureChannel({ id, name: "Servicio aceptado", sound: "aceptar_servicio" });
  }
  for (const id of variantsFor("uber_llego")) {
    await ensureChannel({ id, name: "Ejecutivo llegó", sound: "uber_llego" });
  }
  for (const id of variantsFor("disponibles")) {
    await ensureChannel({ id, name: "Solicitudes cercanas", sound: "disponibles" });
  }
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
