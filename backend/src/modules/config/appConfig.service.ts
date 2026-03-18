import { DriverCreditChargeMode } from "@prisma/client";
import { prisma } from "../../db/prisma";

export const APP_CONFIG_ID = "global";

export const DEFAULT_APP_CONFIG = {
  id: APP_CONFIG_ID,
  driverCreditChargeMode: DriverCreditChargeMode.SERVICE_VALUE,
  driverCreditChargePercent: 0,
  fxCopPerUsd: 0,
  fxCopPerVes: 0,
} as const;

export async function getAppConfig() {
  // Nota: el TS Server de VS Code puede quedar con tipos viejos de Prisma hasta regenerar/reiniciar.
  // Acceso dinámico para evitar falsos positivos en el editor.
  const prismaAny = prisma as any;
  return prismaAny.appConfig.upsert({
    where: { id: APP_CONFIG_ID },
    create: DEFAULT_APP_CONFIG,
    update: {},
  });
}

export function isNightNow(params: { now: Date; startHour: number }) {
  const hour = Math.max(0, Math.min(23, Math.floor(params.now.getHours())));
  const start = Math.max(0, Math.min(23, Math.floor(params.startHour)));
  return hour >= start;
}

export function effectiveBaseFare(params: {
  dayBaseFare: number;
  now: Date;
  nightBaseFare: number;
  nightStartHour: number;
}) {
  const nightFare = Number(params.nightBaseFare ?? 0);
  if (nightFare <= 0) return params.dayBaseFare;

  const night = isNightNow({ now: params.now, startHour: params.nightStartHour });
  return night ? nightFare : params.dayBaseFare;
}
