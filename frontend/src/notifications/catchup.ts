import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

export async function notifyCatchup(params: {
  title: string;
  body: string;
  soundName: "tienes_servicio" | "aceptar_servicio" | "uber_llego" | "disponibles";
  channelId?: string;
  data?: Record<string, any>;
}) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        data: params.data ?? {},
        ...(Platform.OS === "android" ? { channelId: params.channelId ?? params.soundName } : null),
        ...(Platform.OS === "ios" ? { sound: `${params.soundName}.mp3` } : null),
      },
      trigger: null,
    });
  } catch {
    // best-effort
  }
}
