export type SoundName = "tienes_servicio" | "aceptar_servicio" | "uber_llego" | "disponibles";

const CHANNEL_VERSION = "v2";

export function channelIdForSound(soundName: SoundName) {
  return `${soundName}_${CHANNEL_VERSION}`;
}

export function normalizeChannelId(input: unknown, soundName?: SoundName | null) {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) return soundName ? channelIdForSound(soundName) : "";

  // Si llega un canal viejo igual al soundName (sin sufijo), lo movemos a v2.
  if (soundName && raw === soundName) return channelIdForSound(soundName);

  // Si ya viene versionado, lo dejamos.
  if (raw.endsWith(`_${CHANNEL_VERSION}`)) return raw;

  // Si es uno de los conocidos antiguos, lo movemos a v2.
  if (raw === "tienes_servicio") return channelIdForSound("tienes_servicio");
  if (raw === "aceptar_servicio") return channelIdForSound("aceptar_servicio");
  if (raw === "uber_llego") return channelIdForSound("uber_llego");
  if (raw === "disponibles") return channelIdForSound("disponibles");

  return raw;
}
