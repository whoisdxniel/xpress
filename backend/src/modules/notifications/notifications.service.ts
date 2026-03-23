import { PushPlatform } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { getFCMOrNull } from "../../integrations/fcm";

let warnedFcmNotConfigured = false;

function makeEventId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
  const eventId = params.data?.eventId?.trim() ? params.data.eventId.trim() : makeEventId();

  function androidChannelIdForSound(soundName: string | undefined) {
    // Debe matchear los IDs creados en el frontend (notifications/incoming.ts)
    if (soundName && soundName.trim()) return `xpress_sound_${soundName.trim()}_v3`;
    return "xpress_silent_v3";
  }

  const baseData: Record<string, string> = {
    ...(params.data ?? {}),
    eventId,
    ...(soundName ? { soundName } : null),
  };

  const androidTokens = tokens.filter((t) => t.platform === "ANDROID").map((t) => t.token);
  const iosTokens = tokens.filter((t) => t.platform === "IOS").map((t) => t.token);

  let sent = 0;
  let failed = 0;

  // ANDROID: notification + channelId.
  // - Foreground: Expo Notifications handler evita sonido del sistema y la app reproduce el MP3.
  // - Background: Android muestra la notificación y reproduce el MP3 vía canal nativo.
  if (androidTokens.length > 0) {
    const androidData: Record<string, string> = { ...baseData };

    const channelId = androidChannelIdForSound(soundName);

    const resAndroid = await messaging.sendEachForMulticast({
      tokens: androidTokens,
      notification: { title: params.title, body: params.body },
      data: androidData,
      android: {
        priority: "high",
        notification: {
          channelId,
        },
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
      apns: {
        headers: {
          "apns-priority": "10",
        },
      },
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
