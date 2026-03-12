import bcrypt from "bcryptjs";
import { DocumentType, DriverStatus, ServiceType, UserRole } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { sendPushToAdmins, sendPushToUser, sendPushToUserBurst } from "../notifications/notifications.service";
import { APP_CONFIG_ID, DEFAULT_APP_CONFIG, getAppConfig } from "../config/appConfig.service";

function generatePassword(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function createDriverByAdmin(input: {
  email: string;
  password?: string;
  fullName: string;
  phone: string;
  photoUrl: string;
  serviceType: "CARRO" | "MOTO" | "MOTO_CARGA" | "CARRO_CARGA";
  vehicle: {
    brand: string;
    model: string;
    year: number;
    color: string;
    doors?: number;
    hasAC: boolean;
    hasTrunk: boolean;
    allowsPets: boolean;
  };
  documents: {
    vehiclePhotoUrls: string[];
  };
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) return { ok: false as const, error: "Email already in use" };

  const plainPassword = input.password ?? generatePassword(12);
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: UserRole.DRIVER,
      driver: {
        create: {
          fullName: input.fullName,
          phone: input.phone,
          photoUrl: input.photoUrl,
          serviceType:
            input.serviceType === "CARRO"
              ? ServiceType.CARRO
              : input.serviceType === "MOTO"
                ? ServiceType.MOTO
                : input.serviceType === "MOTO_CARGA"
                  ? ServiceType.MOTO_CARGA
                  : ServiceType.CARRO_CARGA,
          status: DriverStatus.APPROVED,
          vehicle: {
            create: {
              brand: input.vehicle.brand,
              model: input.vehicle.model,
              year: input.vehicle.year,
              color: input.vehicle.color,
              doors: input.vehicle.doors,
              hasAC: input.vehicle.hasAC,
              hasTrunk: input.vehicle.hasTrunk,
              allowsPets: input.vehicle.allowsPets,
            },
          },
          documents: {
            create: [
              ...input.documents.vehiclePhotoUrls.map((url) => ({
                type: DocumentType.VEHICLE_PHOTO,
                url,
              })),
            ],
          },
        },
      },
    },
    include: { driver: { include: { vehicle: true, documents: true } } },
  });

  return {
    ok: true as const,
    driverUser: {
      id: user.id,
      email: user.email,
      role: user.role,
      driver: user.driver,
    },
    credentials: {
      user: user.email,
      password: plainPassword,
    },
  };
}

export async function listDrivers() {
  return prisma.driverProfile.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      fullName: true,
      firstName: true,
      lastName: true,
      phone: true,
      photoUrl: true,
      serviceType: true,
      creditChargeFixedCop: true,
      status: true,
      isAvailable: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, email: true, isActive: true, creditAccount: { select: { balanceCop: true } } } },
      vehicle: true,
      documents: true,
      location: true,
    },
  });
}

export async function listPassengers(params: { skip: number; take: number }) {
  return prisma.passengerProfile.findMany({
    skip: params.skip,
    take: params.take,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      fullName: true,
      firstName: true,
      lastName: true,
      phone: true,
      photoUrl: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, email: true } },
    },
  });
}

export async function listRides(params: {
  skip: number;
  take: number;
  status?: string;
  serviceType?: string;
  driverId?: string;
  passengerUserId?: string;
  assignedByAdmin?: boolean;
  dateField?: string;
  from?: Date;
  to?: Date;
}) {
  const where: any = {};
  if (params.status) where.status = params.status;
  if (params.serviceType) where.serviceTypeWanted = params.serviceType;
  if (params.driverId) where.matchedDriverId = params.driverId;
  if (typeof params.assignedByAdmin === "boolean") where.assignedByAdmin = params.assignedByAdmin;
  if (params.passengerUserId) where.passenger = { is: { userId: params.passengerUserId } };

  const allowedDateFields = new Set(["createdAt", "matchedAt", "acceptedAt", "startedAt", "completedAt"]);
  const dateField = allowedDateFields.has(params.dateField ?? "") ? (params.dateField as string) : "createdAt";

  if (params.from || params.to) {
    where[dateField] = {};
    if (params.from) where[dateField].gte = params.from;
    if (params.to) where[dateField].lte = params.to;
  }

  return prisma.rideRequest.findMany({
    skip: params.skip,
    take: params.take,
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      serviceTypeWanted: true,
      wantsAC: true,
      wantsTrunk: true,
      wantsPets: true,
      passengerId: true,
      matchedDriverId: true,
      assignedByAdmin: true,
      pickupLat: true,
      pickupLng: true,
      pickupAddress: true,
      dropoffLat: true,
      dropoffLng: true,
      dropoffAddress: true,
      searchRadiusM: true,
      distanceMeters: true,
      durationSeconds: true,
      estimatedPrice: true,
      agreedPrice: true,
      createdAt: true,
      updatedAt: true,
      matchedAt: true,
      acceptedAt: true,
      startedAt: true,
      completedAt: true,
      passenger: {
        select: {
          id: true,
          userId: true,
          fullName: true,
          firstName: true,
          lastName: true,
          phone: true,
          photoUrl: true,
          user: { select: { id: true, email: true } },
        },
      },
      matchedDriver: {
        select: {
          id: true,
          userId: true,
          fullName: true,
          firstName: true,
          lastName: true,
          phone: true,
          photoUrl: true,
          serviceType: true,
          status: true,
          isAvailable: true,
          location: true,
          vehicle: true,
          user: { select: { id: true, email: true } },
        },
      },
      addons: { include: { addon: true } },
      ratings: true,
    },
  });
}

export async function assignRideDriverByAdmin(params: { rideId: string; driverId: string }) {
  const ride = await prisma.rideRequest.findUnique({
    where: { id: params.rideId },
    include: { passenger: { select: { userId: true } } },
  });
  if (!ride) return { ok: false as const, error: "Ride not found" };

  if (["IN_PROGRESS", "COMPLETED", "CANCELLED", "EXPIRED"].includes(ride.status)) {
    return { ok: false as const, error: "Ride cannot be assigned" };
  }

  const driver = await prisma.driverProfile.findUnique({
    where: { id: params.driverId },
    select: { id: true, serviceType: true, userId: true, fullName: true, user: { select: { isActive: true } } },
  });
  if (!driver) return { ok: false as const, error: "Driver not found" };
  if (!driver.user?.isActive) return { ok: false as const, error: "Driver disabled" };
  if (driver.serviceType !== ride.serviceTypeWanted)
    return { ok: false as const, error: "Driver serviceType mismatch" };

  const updated = await prisma.rideRequest.update({
    where: { id: ride.id },
    data: {
      matchedDriverId: driver.id,
      matchedAt: new Date(),
      status: "ASSIGNED",
      assignedByAdmin: true,
      acceptedAt: null,
    },
    select: {
      id: true,
      status: true,
      serviceTypeWanted: true,
      wantsAC: true,
      wantsTrunk: true,
      wantsPets: true,
      passengerId: true,
      matchedDriverId: true,
      assignedByAdmin: true,
      pickupLat: true,
      pickupLng: true,
      pickupAddress: true,
      dropoffLat: true,
      dropoffLng: true,
      dropoffAddress: true,
      searchRadiusM: true,
      distanceMeters: true,
      durationSeconds: true,
      estimatedPrice: true,
      agreedPrice: true,
      createdAt: true,
      updatedAt: true,
      matchedAt: true,
      acceptedAt: true,
      startedAt: true,
      completedAt: true,
      passenger: {
        select: {
          id: true,
          userId: true,
          fullName: true,
          firstName: true,
          lastName: true,
          phone: true,
          photoUrl: true,
          user: { select: { id: true, email: true } },
        },
      },
      matchedDriver: {
        select: {
          id: true,
          userId: true,
          fullName: true,
          firstName: true,
          lastName: true,
          phone: true,
          photoUrl: true,
          serviceType: true,
          status: true,
          isAvailable: true,
          location: true,
          vehicle: true,
          user: { select: { id: true, email: true } },
        },
      },
      addons: { include: { addon: true } },
      ratings: true,
    },
  });

  void sendPushToUser({
    userId: ride.passenger.userId,
    title: "Chofer asignado",
    body: "El admin asignó un chofer a tu servicio",
    soundName: "aceptar_servicio",
    channelId: "aceptar_servicio",
    data: { rideId: updated.id, type: "RIDE_ASSIGNED" },
  });

  sendPushToUserBurst({
    userId: driver.userId,
    title: "Nuevo servicio",
    body: "Tienes un servicio para aceptar",
    soundName: "tienes_servicio",
    channelId: "tienes_servicio",
    times: 2,
    intervalMs: 1200,
    data: { rideId: updated.id, type: "RIDE_ASSIGNED" },
  });

  void sendPushToAdmins({
    title: "Servicio asignado (admin)",
    body: `Ride ${updated.id} -> Driver ${driver.id}`,
    data: { rideId: updated.id, driverId: driver.id, type: "RIDE_ASSIGNED" },
  });

  return { ok: true as const, ride: updated };
}

export async function adminGetDriverCredits(params: { driverId: string }) {
  const driver = await prisma.driverProfile.findUnique({ where: { id: params.driverId }, select: { userId: true } });
  if (!driver) return { ok: false as const, status: 404 as const, error: "Driver not found" };

  const account = await prisma.creditAccount.findUnique({ where: { userId: driver.userId } });
  return { ok: true as const, balanceCop: account?.balanceCop ?? 0 };
}

export async function adminAdjustDriverCredits(params: { driverId: string; deltaCop: number }) {
  const driver = await prisma.driverProfile.findUnique({ where: { id: params.driverId }, select: { userId: true } });
  if (!driver) return { ok: false as const, status: 404 as const, error: "Driver not found" };

  const account = await prisma.creditAccount.upsert({
    where: { userId: driver.userId },
    create: { userId: driver.userId, balanceCop: params.deltaCop },
    update: { balanceCop: { increment: params.deltaCop } },
  });

  return { ok: true as const, balanceCop: account.balanceCop };
}

export async function adminSetDriverActive(params: { driverId: string; isActive: boolean }) {
  const driver = await prisma.driverProfile.findUnique({ where: { id: params.driverId }, select: { userId: true } });
  if (!driver) return { ok: false as const, status: 404 as const, error: "Driver not found" };

  const user = await prisma.user.update({
    where: { id: driver.userId },
    data: { isActive: params.isActive },
    select: { id: true, email: true, role: true, isActive: true },
  });

  return { ok: true as const, user };
}

export async function adminUpdateDriver(params: {
  driverId: string;
  email?: string;
  fullName?: string;
  phone?: string;
  photoUrl?: string;
  serviceType?: "CARRO" | "MOTO" | "MOTO_CARGA" | "CARRO_CARGA";
  creditChargeFixedCop?: number | null;
  vehicle?: {
    brand?: string;
    model?: string;
    plate?: string | null;
    year?: number;
    color?: string;
    doors?: number | null;
    hasAC?: boolean;
    hasTrunk?: boolean;
    allowsPets?: boolean;
  };
  documents?: {
    vehiclePhotoUrls?: string[];
  };
}) {
  const existingDriver = await prisma.driverProfile.findUnique({
    where: { id: params.driverId },
    include: { user: { select: { id: true, email: true } }, vehicle: true, documents: true },
  });
  if (!existingDriver) return { ok: false as const, status: 404 as const, error: "Driver not found" };

  // Email (User)
  if (params.email && params.email !== existingDriver.user.email) {
    const already = await prisma.user.findUnique({ where: { email: params.email } });
    if (already) return { ok: false as const, status: 409 as const, error: "Email already in use" };
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (params.email) {
      await tx.user.update({ where: { id: existingDriver.userId }, data: { email: params.email } });
    }

    const driverRow = await tx.driverProfile.update({
      where: { id: existingDriver.id },
      data: {
        ...(params.fullName ? { fullName: params.fullName } : null),
        ...(params.phone ? { phone: params.phone } : null),
        ...(params.photoUrl ? { photoUrl: params.photoUrl } : null),
        ...(params.serviceType ? { serviceType: params.serviceType as any } : null),
        ...(params.creditChargeFixedCop !== undefined ? { creditChargeFixedCop: params.creditChargeFixedCop } : null),
      },
      include: { user: { select: { id: true, email: true, isActive: true, creditAccount: { select: { balanceCop: true } } } }, vehicle: true, documents: true, location: true },
    });

    if (params.vehicle && driverRow.vehicle) {
      await tx.vehicle.update({
        where: { driverId: driverRow.id },
        data: {
          ...(params.vehicle.brand != null ? { brand: params.vehicle.brand } : null),
          ...(params.vehicle.model != null ? { model: params.vehicle.model } : null),
          ...(params.vehicle.plate !== undefined ? { plate: params.vehicle.plate } : null),
          ...(params.vehicle.year != null ? { year: params.vehicle.year } : null),
          ...(params.vehicle.color != null ? { color: params.vehicle.color } : null),
          ...(params.vehicle.doors !== undefined ? { doors: params.vehicle.doors } : null),
          ...(params.vehicle.hasAC != null ? { hasAC: params.vehicle.hasAC } : null),
          ...(params.vehicle.hasTrunk != null ? { hasTrunk: params.vehicle.hasTrunk } : null),
          ...(params.vehicle.allowsPets != null ? { allowsPets: params.vehicle.allowsPets } : null),
        },
      });
    }

    if (params.documents?.vehiclePhotoUrls) {
      const urls = params.documents.vehiclePhotoUrls;

      await tx.driverDocument.deleteMany({ where: { driverId: driverRow.id, type: DocumentType.VEHICLE_PHOTO } });
      if (urls.length) {
        await tx.driverDocument.createMany({
          data: urls.map((url) => ({ driverId: driverRow.id, type: DocumentType.VEHICLE_PHOTO, url })),
        });
      }
    }

    return tx.driverProfile.findUnique({
      where: { id: driverRow.id },
      include: { user: { select: { id: true, email: true, isActive: true, creditAccount: { select: { balanceCop: true } } } }, vehicle: true, documents: true, location: true },
    });
  });

  return { ok: true as const, driver: updated };
}

export async function adminGetAppConfig() {
  const [appConfig, pricingCarro, anyPricing] = await Promise.all([
    getAppConfig(),
    prisma.pricingConfig.findUnique({ where: { serviceType: ServiceType.CARRO } }),
    prisma.pricingConfig.findFirst({ orderBy: { serviceType: "asc" } }),
  ]);

  const pricing = pricingCarro ?? anyPricing;

  return {
    ok: true as const,
    appConfig: {
      id: appConfig.id,
      nightBaseFare: Number(appConfig.nightBaseFare ?? 0),
      nightStartHour: appConfig.nightStartHour,
      driverCreditChargeMode: appConfig.driverCreditChargeMode,
      driverCreditChargePercent: Number((appConfig as any).driverCreditChargePercent ?? 0),
    },
    pricing: {
      baseFare: Number(pricing?.baseFare ?? 0),
      perKm: Number(pricing?.perKm ?? 0),
      includedMeters: Number((pricing as any)?.includedMeters ?? 0),
      stepMeters: Number((pricing as any)?.stepMeters ?? 0),
      stepPrice: Number((pricing as any)?.stepPrice ?? 0),
    },
  };
}

export async function adminUpdateAppConfig(input: {
  pricingBaseFare?: number;
  pricingPerKm?: number;
  pricingIncludedMeters?: number;
  pricingStepMeters?: number;
  pricingStepPrice?: number;
  nightBaseFare: number;
  nightStartHour: number;
  driverCreditChargePercent?: number;
  driverCreditChargeMode: "SERVICE_VALUE" | "FIXED_AMOUNT";
}) {
  const serviceTypes: ServiceType[] = [
    ServiceType.CARRO,
    ServiceType.MOTO,
    ServiceType.MOTO_CARGA,
    ServiceType.CARRO_CARGA,
  ];

  const shouldUpdatePricing =
    input.pricingBaseFare !== undefined ||
    input.pricingPerKm !== undefined ||
    input.pricingIncludedMeters !== undefined ||
    input.pricingStepMeters !== undefined ||
    input.pricingStepPrice !== undefined;

  const includedMeters = Math.max(0, Math.floor(Number(input.pricingIncludedMeters ?? 0)));
  const stepMeters = Math.max(0, Math.floor(Number(input.pricingStepMeters ?? 0)));
  const stepPrice = Math.max(0, Number(input.pricingStepPrice ?? 0));
  const driverCreditChargePercent = Math.max(0, Math.min(100, Number(input.driverCreditChargePercent ?? 0)));

  const updated = await prisma.$transaction(async (tx) => {
    const cfg = await tx.appConfig.upsert({
      where: { id: APP_CONFIG_ID },
      create: {
        ...DEFAULT_APP_CONFIG,
        id: APP_CONFIG_ID,
        nightBaseFare: input.nightBaseFare,
        nightStartHour: input.nightStartHour,
        driverCreditChargeMode: input.driverCreditChargeMode as any,
        driverCreditChargePercent,
      },
      update: {
        nightBaseFare: input.nightBaseFare,
        nightStartHour: input.nightStartHour,
        driverCreditChargeMode: input.driverCreditChargeMode as any,
        driverCreditChargePercent,
      },
    });

    if (shouldUpdatePricing) {
      const baseFare = Math.max(0, Number(input.pricingBaseFare ?? 0));
      const perKm = Math.max(0, Number(input.pricingPerKm ?? 0));

      for (const st of serviceTypes) {
        await tx.pricingConfig.upsert({
          where: { serviceType: st },
          update: {
            baseFare,
            perKm,
            includedMeters,
            stepMeters,
            stepPrice,
          },
          create: {
            serviceType: st,
            baseFare,
            perKm,
            includedMeters,
            stepMeters,
            stepPrice,
            acSurcharge: 0,
            trunkSurcharge: 0,
            petsSurcharge: 0,
          },
        });
      }
    }

    return cfg;
  });

  return {
    ok: true as const,
    appConfig: {
      id: updated.id,
      nightBaseFare: Number(updated.nightBaseFare ?? 0),
      nightStartHour: updated.nightStartHour,
      driverCreditChargeMode: updated.driverCreditChargeMode,
      driverCreditChargePercent: Number((updated as any).driverCreditChargePercent ?? 0),
    },
    pricing: {
      baseFare: Number(input.pricingBaseFare ?? 0),
      perKm: Number(input.pricingPerKm ?? 0),
      includedMeters,
      stepMeters,
      stepPrice,
    },
  };
}

export async function listPricingAddons(params: { serviceType?: string; isActive?: boolean }) {
  const where: any = {};
  if (params.serviceType) where.serviceType = params.serviceType;
  if (typeof params.isActive === "boolean") where.isActive = params.isActive;

  return prisma.pricingAddon.findMany({
    where,
    orderBy: [{ serviceType: "asc" }, { name: "asc" }],
  });
}

export async function createPricingAddon(input: {
  serviceType: "CARRO" | "MOTO" | "MOTO_CARGA" | "CARRO_CARGA";
  name: string;
  amount: number;
  isActive: boolean;
}) {
  const pricing = await prisma.pricingConfig.findUnique({
    where: { serviceType: input.serviceType as ServiceType },
    select: { serviceType: true },
  });
  if (!pricing) return { ok: false as const, error: "Pricing not configured for this service type" };

  const existing = await prisma.pricingAddon.findFirst({
    where: { serviceType: input.serviceType as ServiceType, name: input.name },
    select: { id: true },
  });
  if (existing) return { ok: false as const, error: "Addon name already exists for this service type" };

  const addon = await prisma.pricingAddon.create({
    data: {
      serviceType: input.serviceType as ServiceType,
      name: input.name,
      amount: input.amount,
      isActive: input.isActive,
    },
  });

  return { ok: true as const, addon };
}

export async function updatePricingAddon(params: {
  addonId: string;
  name?: string;
  amount?: number;
  isActive?: boolean;
}) {
  if (params.name) {
    const current = await prisma.pricingAddon.findUnique({
      where: { id: params.addonId },
      select: { id: true, serviceType: true },
    });

    if (current) {
      const existing = await prisma.pricingAddon.findFirst({
        where: {
          serviceType: current.serviceType,
          name: params.name,
          id: { not: current.id },
        },
        select: { id: true },
      });

      if (existing) {
        return { ok: false as const, error: "Addon name already exists for this service type" };
      }
    }
  }

  const addon = await prisma.pricingAddon.update({
    where: { id: params.addonId },
    data: {
      name: params.name,
      amount: params.amount,
      isActive: params.isActive,
    },
  });

  return { ok: true as const, addon };
}

export async function deactivatePricingAddon(params: { addonId: string }) {
  return prisma.pricingAddon.update({
    where: { id: params.addonId },
    data: { isActive: false },
  });
}

export async function listRatings(params: { skip: number; take: number }) {
  return prisma.rating.findMany({
    skip: params.skip,
    take: params.take,
    orderBy: { createdAt: "desc" },
  });
}

export async function approveDriver(params: { driverId: string; status: "OBSERVATION" | "APPROVED" | "REJECTED" }) {
  return prisma.driverProfile.update({
    where: { id: params.driverId },
    data: { status: params.status as DriverStatus },
    include: { user: { select: { id: true, email: true } }, vehicle: true, documents: true },
  });
}

export async function upsertPricing(params: {
  serviceType: "CARRO" | "MOTO" | "MOTO_CARGA" | "CARRO_CARGA";
  baseFare: number;
  perKm: number;
  includedMeters?: number;
  stepMeters?: number;
  stepPrice?: number;
  acSurcharge: number;
  trunkSurcharge: number;
  petsSurcharge: number;
}) {
  const includedMeters = Math.max(0, Math.floor(Number(params.includedMeters ?? 0)));
  const stepMeters = Math.max(0, Math.floor(Number(params.stepMeters ?? 0)));
  const stepPrice = Math.max(0, Number(params.stepPrice ?? 0));

  return prisma.pricingConfig.upsert({
    where: { serviceType: params.serviceType as ServiceType },
    update: {
      baseFare: params.baseFare,
      perKm: params.perKm,
      includedMeters,
      stepMeters,
      stepPrice,
      acSurcharge: params.acSurcharge,
      trunkSurcharge: params.trunkSurcharge,
      petsSurcharge: params.petsSurcharge,
    },
    create: {
      serviceType: params.serviceType as ServiceType,
      baseFare: params.baseFare,
      perKm: params.perKm,
      includedMeters,
      stepMeters,
      stepPrice,
      acSurcharge: params.acSurcharge,
      trunkSurcharge: params.trunkSurcharge,
      petsSurcharge: params.petsSurcharge,
    },
  });
}

export async function getPricing() {
  return prisma.pricingConfig.findMany({ orderBy: { serviceType: "asc" } });
}

export async function getMetrics(params: { from?: Date; to?: Date }) {
  const where: any = {};
  if (params.from || params.to) {
    where.createdAt = {};
    if (params.from) where.createdAt.gte = params.from;
    if (params.to) where.createdAt.lte = params.to;
  }

  const [total, completed, cancelled, inProgress, open, assigned, accepted] = await Promise.all([
    prisma.rideRequest.count({ where }),
    prisma.rideRequest.count({ where: { ...where, status: "COMPLETED" } }),
    prisma.rideRequest.count({ where: { ...where, status: "CANCELLED" } }),
    prisma.rideRequest.count({ where: { ...where, status: "IN_PROGRESS" } }),
    prisma.rideRequest.count({ where: { ...where, status: "OPEN" } }),
    prisma.rideRequest.count({ where: { ...where, status: "ASSIGNED" } }),
    prisma.rideRequest.count({ where: { ...where, status: "ACCEPTED" } }),
  ]);

  const revenueAgg = await prisma.rideRequest.aggregate({
    where: { ...where, status: "COMPLETED" },
    _sum: { meterPrice: true },
  });

  const topDrivers = await prisma.rideRequest.groupBy({
    by: ["matchedDriverId"],
    where: { ...where, status: "COMPLETED", matchedDriverId: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  return {
    totalRides: total,
    openRides: open,
    assignedRides: assigned,
    acceptedRides: accepted,
    completedRides: completed,
    cancelledRides: cancelled,
    inProgressRides: inProgress,
    revenueCompleted: revenueAgg._sum.meterPrice ?? 0,
    topDrivers,
  };
}
