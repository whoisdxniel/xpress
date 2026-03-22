import { Audio } from "expo-av";
import { Platform } from "react-native";
import type { SoundName } from "./channels";

const SOUND_ASSETS: Record<SoundName, any> = {
  tienes_servicio: require("../../assets/notifications/tienes_servicio.mp3"),
  aceptar_servicio: require("../../assets/notifications/aceptar_servicio.mp3"),
  uber_llego: require("../../assets/notifications/uber_llego.mp3"),
  disponibles: require("../../assets/notifications/disponibles.mp3"),
};

let audioModeReady = false;
let playChain: Promise<void> = Promise.resolve();

async function ensureAudioMode() {
  if (audioModeReady) return;
  audioModeReady = true;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
  } catch {
    // best-effort
  }
}

export function playNotificationSound(soundName: SoundName) {
  // Serializa para evitar solapamientos (varias notifs juntas).
  playChain = playChain.then(async () => {
    await ensureAudioMode();

    const source = SOUND_ASSETS[soundName];
    if (!source) return;

    try {
      const { sound } = await Audio.Sound.createAsync(
        source,
        {
          shouldPlay: true,
          volume: 1.0,
          isLooping: false,
        },
        undefined,
        false
      );

      // En background/headless no siempre llegan updates; descargamos por timeout.
      const unload = async () => {
        try {
          await sound.unloadAsync();
        } catch {
          // silencioso
        }
      };

      let unloaded = false;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (unloaded) return;
        if (!status.isLoaded) return;
        if ((status as any).didJustFinish) {
          unloaded = true;
          void unload();
        }
      });

      // Fallback: liberar tras 8s
      setTimeout(() => {
        if (unloaded) return;
        unloaded = true;
        void unload();
      }, 8000);

      // En Android, si el sistema ya está reproduciendo el sonido de notificación,
      // a veces el audio focus puede limitar el volumen. Aun así, esto es best-effort.
      if (Platform.OS === "android") {
        // nada extra
      }
    } catch {
      // best-effort
    }
  });

  return playChain;
}
