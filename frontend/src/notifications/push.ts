import Constants from "expo-constants";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

function isExpoGo() {
  const executionEnvironment = (Constants as any)?.executionEnvironment;
  if (executionEnvironment != null) return executionEnvironment === "storeClient";

  // Fallback para versiones viejas de expo-constants.
  const appOwnership = (Constants as any)?.appOwnership;
  return appOwnership === "expo";
}

export function setupNotificationHandlerOnce() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureAndroidChannels() {
  if (Platform.OS !== "android") return;

  // Canal por sonido, para que FCM pueda elegir canalId.
  await Notifications.setNotificationChannelAsync("tienes_servicio", {
    name: "Servicios por aceptar",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: "tienes_servicio",
  });

  await Notifications.setNotificationChannelAsync("aceptar_servicio", {
    name: "Servicio aceptado",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: "aceptar_servicio",
  });

  await Notifications.setNotificationChannelAsync("uber_llego", {
    name: "Ejecutivo llegó",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: "uber_llego",
  });
}

export async function getNativePushToken() {
  // Desde Expo SDK 53, Expo Go ya no soporta push remoto.
  // Para testear push, usar un development build (EAS dev client) o standalone.
  if (Platform.OS === "web" || isExpoGo()) return null;

  const settings = await Notifications.getPermissionsAsync();
  const granted = settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  if (!granted) {
    const req = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });

    const ok = req.granted || req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    if (!ok) return null;
  }

  const tokenRes = await Notifications.getDevicePushTokenAsync();
  const platform = Platform.OS === "ios" ? ("IOS" as const) : ("ANDROID" as const);

  return { token: tokenRes.data, platform };
}
