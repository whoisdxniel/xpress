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

  // Canal por sonido, para que FCM pueda elegir canalId.
  await Notifications.setNotificationChannelAsync(channelIdForSound("tienes_servicio"), {
    name: "Servicios por aceptar",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: "tienes_servicio",
  });

  await Notifications.setNotificationChannelAsync(channelIdForSound("aceptar_servicio"), {
    name: "Servicio aceptado",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: "aceptar_servicio",
  });

  await Notifications.setNotificationChannelAsync(channelIdForSound("uber_llego"), {
    name: "Ejecutivo llegó",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: "uber_llego",
  });

  await Notifications.setNotificationChannelAsync(channelIdForSound("disponibles"), {
    name: "Solicitudes cercanas",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: "disponibles",
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
