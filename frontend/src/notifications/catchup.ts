import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { channelIdForSound, type SoundName } from "./channels";

export async function notifyCatchup(params: {
  title: string;
  body: string;
  soundName: SoundName;
  channelId?: string;
  data?: Record<string, any>;
}) {
  try {
    const channelId = params.channelId?.trim() ? params.channelId.trim() : channelIdForSound(params.soundName);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        data: params.data ?? {},
        ...(Platform.OS === "android" ? { channelId } : null),
        ...(Platform.OS === "ios" ? { sound: `${params.soundName}.mp3` } : null),
      },
      trigger: null,
    });
  } catch {
    // best-effort
  }
}
