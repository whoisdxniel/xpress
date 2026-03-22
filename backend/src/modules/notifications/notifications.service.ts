import { PushPlatform } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { getFCMOrNull } from "../../integrations/fcm";

let warnedFcmNotConfigured = false;

const CHANNEL_VERSION_SUFFIX = "_v3";

function channelIdForSound(soundName: string) {
  return `${soundName}${CHANNEL_VERSION_SUFFIX}`;
}

function normalizeChannelId(params: { soundName?: string; channelId?: string }) {
  const soundName = params.soundName?.trim() ? params.soundName.trim() : "";
  if (!soundName) return undefined;

  const raw = params.channelId?.trim() ? params.channelId.trim() : "";
  if (!raw) return channelIdForSound(soundName);

  // Si el caller pasa el id antiguo igual al soundName, migramos a v2.
  if (raw === soundName) return channelIdForSound(soundName);

  // Si ya viene versionado, lo dejamos.
  if (raw.endsWith(CHANNEL_VERSION_SUFFIX)) return raw;

  // Si viene de una versión anterior, migramos al id actual.
  if (raw.endsWith("_v2")) return channelIdForSound(soundName);

  // Si es uno de los ids antiguos conocidos, migramos a v2.
  if (raw === "tienes_servicio") return channelIdForSound("tienes_servicio");
  if (raw === "aceptar_servicio") return channelIdForSound("aceptar_servicio");
  if (raw === "uber_llego") return channelIdForSound("uber_llego");
  if (raw === "disponibles") return channelIdForSound("disponibles");

  return raw;
}

function normalizeAnyChannelId(channelIdRaw?: string) {
  const raw = channelIdRaw?.trim() ? channelIdRaw.trim() : "";
  if (!raw) return "";

  // Si ya viene versionado v3, lo dejamos.
  if (raw.endsWith(CHANNEL_VERSION_SUFFIX)) return raw;

  // Si viene de v2, migramos a v3.
  if (raw.endsWith("_v2")) {
    const base = raw.slice(0, -3); // quita _v2
    return `${base}${CHANNEL_VERSION_SUFFIX}`;
  }

  // Mapeo de ids legacy conocidos.
  if (raw === "tienes_servicio") return channelIdForSound("tienes_servicio");
  if (raw === "aceptar_servicio") return channelIdForSound("aceptar_servicio");
  if (raw === "uber_llego") return channelIdForSound("uber_llego");
  if (raw === "disponibles") return channelIdForSound("disponibles");

  return raw;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function registerPushToken(params: {
  userId: string;
  token: string;
  platform: "ANDROID" | "IOS";
}) {
  return prisma.pushToken.upsert({
    where: { token: params.token },
    update: { userId: params.userId, platform: params.platform as PushPlatform },
    create: { userId: params.userId, token: params.token, platform: params.platform as PushPlatform },
  });
}

export async function sendPushToUser(params: {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  soundName?: string;
  channelId?: string;
}) {
  const messaging = getFCMOrNull();
  if (!messaging) {
    if (!warnedFcmNotConfigured) {
      warnedFcmNotConfigured = true;
      console.warn("[push] FCM no configurado. Revisar FCM_SERVICE_ACCOUNT_JSON/FCM_SERVICE_ACCOUNT_PATH");
    }
    return { ok: false as const, reason: "FCM_NOT_CONFIGURED" };
  }

  const tokens = await prisma.pushToken.findMany({ where: { userId: params.userId } });
  if (tokens.length === 0) return { ok: true as const, sent: 0, failed: 0 };

  const soundName = params.soundName?.trim() ? params.soundName.trim() : undefined;
  const normalizedChannelId = soundName ? normalizeChannelId({ soundName, channelId: params.channelId }) : undefined;

  // En Android usamos un canal único con sonido default del teléfono.
  // El sonido MP3 específico se reproduce desde la app (TaskManager) al recibir el push.
  const androidChannelId = "xpress_default_v1";

  const baseData: Record<string, string> | undefined = soundName
    ? {
        ...(params.data ?? {}),
        soundName,
        ...(normalizedChannelId ? { channelId: normalizedChannelId } : null),
      }
    : params.data;

  const androidTokens = tokens.filter((t) => t.platform === "ANDROID").map((t) => t.token);
  const iosTokens = tokens.filter((t) => t.platform === "IOS").map((t) => t.token);

  let sent = 0;
  let failed = 0;

  // ANDROID: data-only (para que onMessageReceived corra en background) + payload Expo (title/message/sound/channelId)
  if (androidTokens.length > 0) {
    const androidData: Record<string, string> = {
      ...(baseData ?? {}),
      title: params.title,
      message: params.body,
      channelId: androidChannelId,
      // Nota: NO enviamos `sound` aquí para que el sistema use el sonido default del teléfono.
      // El MP3 específico se reproduce desde JS leyendo `soundName`.
    };

    const resAndroid = await messaging.sendEachForMulticast({
      tokens: androidTokens,
      data: androidData,
      android: {
        priority: "high",
      },
    });

    sent += resAndroid.successCount;
    failed += resAndroid.failureCount;
  }

  // IOS: mantenemos notificación/APNs estándar.
  if (iosTokens.length > 0) {
    const resIos = await messaging.sendEachForMulticast({
      tokens: iosTokens,
      notification: { title: params.title, body: params.body },
      data: baseData,
      apns: soundName
        ? {
            headers: {
              "apns-priority": "10",
            },
            payload: {
              aps: {
                sound: `${soundName}.mp3`,
              },
            },
          }
        : undefined,
    });

    sent += resIos.successCount;
    failed += resIos.failureCount;
  }

  return { ok: true as const, sent, failed };
}

export function sendPushToUserBurst(params: {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  soundName: string;
  channelId?: string;
  times: number;
  intervalMs?: number;
}) {
  const times = Math.min(5, Math.max(1, Math.floor(params.times)));
  const intervalMs = Math.min(10_000, Math.max(250, Math.floor(params.intervalMs ?? 1500)));

  // Fire-and-forget: no bloquea la request.
  void (async () => {
    for (let i = 0; i < times; i++) {
      try {
        await sendPushToUser({
          userId: params.userId,
          title: params.title,
          body: params.body,
          soundName: params.soundName,
          channelId: params.channelId,
          data: {
            ...(params.data ?? {}),
            soundName: params.soundName,
            burstCount: String(times),
            burstIndex: String(i + 1),
            burstId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          },
        });
      } catch {
        // silencioso
      }

      if (i < times - 1) await sleep(intervalMs);
    }
  })();
}

export async function sendPushToAdmins(params: {
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  const results = await Promise.all(admins.map((a) => sendPushToUser({ userId: a.id, ...params })));
  const sent = results.reduce((acc, r) => (r.ok ? acc + r.sent : acc), 0);
  const failed = results.reduce((acc, r) => (r.ok ? acc + r.failed : acc), 0);
  return { ok: true as const, sent, failed };
}
