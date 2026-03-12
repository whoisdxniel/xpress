import { prisma } from "../../db/prisma";
import { getAppConfig } from "../config/appConfig.service";

export async function getOrCreateCreditAccount(params: { userId: string }) {
  return prisma.creditAccount.upsert({
    where: { userId: params.userId },
    update: {},
    create: { userId: params.userId, balanceCop: 0 },
  });
}

export async function getMyCredits(params: { userId: string }) {
  const account = await getOrCreateCreditAccount({ userId: params.userId });
  return { ok: true as const, balanceCop: account.balanceCop };
}

function rideFinalAmountCop(ride: {
  meterPrice: any;
  agreedPrice: any;
  estimatedPrice: any;
}) {
  const meter = Number(ride.meterPrice ?? 0);
  const agreed = Number(ride.agreedPrice ?? 0);
  const estimated = Number(ride.estimatedPrice ?? 0);

  const value = meter > 0 ? meter : agreed > 0 ? agreed : estimated;
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}

export async function chargeDriverCreditsForCompletedRide(params: { rideId: string; now?: Date }) {
  const now = params.now ?? new Date();

  const ride = await prisma.rideRequest.findUnique({
    where: { id: params.rideId },
    select: {
      id: true,
      status: true,
      meterPrice: true,
      agreedPrice: true,
      estimatedPrice: true,
      driverCreditChargedAt: true,
      matchedDriver: { select: { userId: true, creditChargeFixedCop: true } },
    },
  });

  if (!ride) return { ok: false as const, status: 404 as const, error: "Ride not found" };
  if (ride.status !== "COMPLETED") return { ok: true as const, charged: false as const, reason: "not_completed" };
  if (!ride.matchedDriver?.userId) return { ok: true as const, charged: false as const, reason: "no_driver" };
  if (ride.driverCreditChargedAt) return { ok: true as const, charged: false as const, reason: "already_charged" };

  const appConfig = await getAppConfig();

  let amountCop = 0;

  const pct = Number((appConfig as any).driverCreditChargePercent ?? 0);
  if (Number.isFinite(pct) && pct > 0) {
    const base = rideFinalAmountCop(ride);
    amountCop = Math.max(0, Math.round((base * pct) / 100));
  } else if (appConfig.driverCreditChargeMode === "SERVICE_VALUE") {
    amountCop = rideFinalAmountCop(ride);
  } else {
    const fixed = ride.matchedDriver?.creditChargeFixedCop ?? 0;
    amountCop = Math.max(0, Math.round(Number.isFinite(Number(fixed)) ? Number(fixed) : 0));
  }

  if (amountCop <= 0) {
    // Marcamos como cobrado para evitar reintentos innecesarios si el monto final es 0.
    const mark = await prisma.rideRequest.updateMany({
      where: { id: ride.id, status: "COMPLETED", driverCreditChargedAt: null },
      data: { driverCreditChargedAt: now, driverCreditChargedCop: 0 },
    });
    return { ok: true as const, charged: mark.count === 1, amountCop: 0 };
  }

  const result = await prisma.$transaction(async (tx) => {
    const marked = await tx.rideRequest.updateMany({
      where: { id: ride.id, status: "COMPLETED", driverCreditChargedAt: null },
      data: { driverCreditChargedAt: now, driverCreditChargedCop: amountCop },
    });

    if (marked.count !== 1) {
      return { charged: false as const };
    }

    const account = await tx.creditAccount.upsert({
      where: { userId: ride.matchedDriver!.userId },
      create: { userId: ride.matchedDriver!.userId, balanceCop: -amountCop },
      update: { balanceCop: { decrement: amountCop } },
    });

    return { charged: true as const, account };
  });

  return {
    ok: true as const,
    charged: result.charged,
    amountCop,
    balanceCop: result.charged ? result.account.balanceCop : undefined,
  };
}
