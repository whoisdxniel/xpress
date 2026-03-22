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
  const channelId = soundName ? normalizeChannelId({ soundName, channelId: params.channelId }) : undefined;

  const data: Record<string, string> | undefined = soundName
    ? {
        ...(params.data ?? {}),
        soundName,
        ...(channelId ? { channelId } : null),
      }
    : params.data;

  const res = await messaging.sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    notification: { title: params.title, body: params.body },
    data,
    android: {
      priority: "high",
      notification: soundName
        ? {
            sound: soundName,
            channelId: channelId,
          }
        : undefined,
    },
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

  return { ok: true as const, sent: res.successCount, failed: res.failureCount };
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
