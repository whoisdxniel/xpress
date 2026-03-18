import { apiRequest } from "../lib/api";

export type AdminDriverStatus = "OBSERVATION" | "APPROVED" | "REJECTED";
export type ServiceType = "CARRO" | "MOTO" | "MOTO_CARGA" | "CARRO_CARGA";
export type DriverCreditChargeMode = "SERVICE_VALUE" | "FIXED_AMOUNT";

export function apiAdminListDrivers(token: string) {
  return apiRequest<{ ok: true; drivers: any[] }>({
    method: "GET",
    path: "/admin/drivers",
    token,
  });
}

export function apiAdminListPassengers(token: string, input?: { take?: number; skip?: number }) {
  const params = new URLSearchParams();
  if (input?.take) params.set("take", String(input.take));
  if (input?.skip) params.set("skip", String(input.skip));
  const qs = params.toString();

  return apiRequest<{ ok: true; passengers: any[] }>({
    method: "GET",
    path: `/admin/passengers${qs ? `?${qs}` : ""}`,
    token,
  });
}

export function apiAdminSetPassengerActive(token: string, input: { passengerId: string; isActive: boolean }) {
  return apiRequest<{ ok: true; user: any }>({
    method: "PATCH",
    path: `/admin/passengers/${input.passengerId}/active`,
    token,
    body: { isActive: input.isActive },
  });
}

export function apiAdminUpdatePassenger(
  token: string,
  input: {
    passengerId: string;
    email?: string;
    fullName?: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string;
    photoUrl?: string | null;
  }
) {
  return apiRequest<{ ok: true; passenger: any }>({
    method: "PATCH",
    path: `/admin/passengers/${input.passengerId}`,
    token,
    body: {
      email: input.email,
      fullName: input.fullName,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      photoUrl: input.photoUrl,
    },
  });
}

export function apiAdminDeletePassenger(token: string, input: { passengerId: string }) {
  return apiRequest<{ ok: true }>({
    method: "DELETE",
    path: `/admin/passengers/${input.passengerId}`,
    token,
  });
}

export function apiAdminUpdateDriverStatus(token: string, input: { driverId: string; status: AdminDriverStatus }) {
  return apiRequest<{ ok: true; driver: any }>({
    method: "PATCH",
    path: `/admin/drivers/${input.driverId}/status`,
    token,
    body: { status: input.status },
  });
}

export function apiAdminCreateDriver(
  token: string,
  input: {
    email: string;
    password?: string;
    fullName: string;
    phone: string;
    photoUrl: string;
    serviceType: ServiceType;
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
  }
) {
  return apiRequest<{ ok: true; driverUser: any; credentials: { user: string; password: string } }>({
    method: "POST",
    path: "/admin/drivers",
    token,
    body: input,
  });
}

export function apiAdminUpdateDriver(
  token: string,
  input: {
    driverId: string;
    email?: string;
    fullName?: string;
    phone?: string;
    photoUrl?: string;
    serviceType?: ServiceType;
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
  }
) {
  return apiRequest<{ ok: true; driver: any }>({
    method: "PATCH",
    path: `/admin/drivers/${input.driverId}`,
    token,
    body: {
      email: input.email,
      fullName: input.fullName,
      phone: input.phone,
      photoUrl: input.photoUrl,
      serviceType: input.serviceType,
      creditChargeFixedCop: input.creditChargeFixedCop,
      vehicle: input.vehicle,
      documents: input.documents,
    },
  });
}

export function apiAdminHardDeleteDriver(token: string, input: { driverId: string }) {
  return apiRequest<{ ok: true }>({
    method: "DELETE",
    path: `/admin/drivers/${input.driverId}`,
    token,
  });
}

export function apiAdminGetAppConfig(token: string) {
  return apiRequest<{
    ok: true;
    appConfig: {
      id: string;
      driverCreditChargeMode: DriverCreditChargeMode;
      driverCreditChargePercent: number;
      fxCopPerUsd: number;
      fxCopPerVes: number;
    };
    pricing: {
      baseFare: number;
      perKm: number;
      includedMeters: number;
      stepMeters: number;
      stepPrice: number;
    };
  }>({
    method: "GET",
    path: "/admin/app-config",
    token,
  });
}

export function apiAdminUpdateAppConfig(
  token: string,
  input: {
    pricingBaseFare?: number;
    pricingPerKm?: number;
    pricingIncludedMeters?: number;
    pricingStepMeters?: number;
    pricingStepPrice?: number;
    driverCreditChargePercent?: number;
    driverCreditChargeMode?: DriverCreditChargeMode;
    fxCopPerUsd?: number;
    fxCopPerVes?: number;
  }
) {
  const body: any = {
    driverCreditChargePercent: input.driverCreditChargePercent,
    driverCreditChargeMode: input.driverCreditChargeMode,
    fxCopPerUsd: input.fxCopPerUsd,
    fxCopPerVes: input.fxCopPerVes,
  };

  if (input.pricingBaseFare !== undefined) body.pricingBaseFare = input.pricingBaseFare;
  if (input.pricingPerKm !== undefined) body.pricingPerKm = input.pricingPerKm;
  if (input.pricingIncludedMeters !== undefined) body.pricingIncludedMeters = input.pricingIncludedMeters;
  if (input.pricingStepMeters !== undefined) body.pricingStepMeters = input.pricingStepMeters;
  if (input.pricingStepPrice !== undefined) body.pricingStepPrice = input.pricingStepPrice;

  return apiRequest<{
    ok: true;
    appConfig: {
      id: string;
      driverCreditChargeMode: DriverCreditChargeMode;
      driverCreditChargePercent: number;
      fxCopPerUsd: number;
      fxCopPerVes: number;
    };
    pricing: {
      baseFare: number;
      perKm: number;
      includedMeters: number;
      stepMeters: number;
      stepPrice: number;
    };
  }>({
    method: "PUT",
    path: "/admin/app-config",
    token,
    body,
  });
}

export function apiAdminSetDriverActive(token: string, input: { driverId: string; isActive: boolean }) {
  return apiRequest<{ ok: true; user: any }>({
    method: "PATCH",
    path: `/admin/drivers/${input.driverId}/active`,
    token,
    body: { isActive: input.isActive },
  });
}

export function apiAdminGetDriverCredits(token: string, input: { driverId: string }) {
  return apiRequest<{ ok: true; balanceCop: number }>({
    method: "GET",
    path: `/admin/drivers/${input.driverId}/credits`,
    token,
  });
}

export function apiAdminAdjustDriverCredits(token: string, input: { driverId: string; deltaCop: number }) {
  return apiRequest<{ ok: true; balanceCop: number }>({
    method: "PATCH",
    path: `/admin/drivers/${input.driverId}/credits`,
    token,
    body: { deltaCop: input.deltaCop },
  });
}

export function apiAdminListRides(token: string, input?: { take?: number; skip?: number }) {
  const params = new URLSearchParams();
  if (input?.take) params.set("take", String(input.take));
  if (input?.skip) params.set("skip", String(input.skip));

  const qs = params.toString();

  return apiRequest<{ ok: true; rides: any[] }>({
    method: "GET",
    path: `/admin/rides${qs ? `?${qs}` : ""}`,
    token,
  });
}

export function apiAdminAssignRideDriver(token: string, input: { rideId: string; driverId: string }) {
  return apiRequest<{ ok: true; ride: any }>({
    method: "POST",
    path: `/admin/rides/${input.rideId}/assign-driver`,
    token,
    body: { driverId: input.driverId },
  });
}

export function apiAdminListPasswordResets(token: string, input?: { take?: number }) {
  const params = new URLSearchParams();
  if (input?.take) params.set("take", String(input.take));
  const qs = params.toString();

  return apiRequest<{ ok: true; requests: any[] }>({
    method: "GET",
    path: `/admin/password-resets${qs ? `?${qs}` : ""}`,
    token,
  });
}

export function apiAdminGetPricing(token: string) {
  return apiRequest<{ ok: true; pricing: any[] }>({
    method: "GET",
    path: "/admin/pricing",
    token,
  });
}

export function apiAdminUpsertPricing(
  token: string,
  input: {
    serviceType: ServiceType;
    baseFare: number;
    nightBaseFare?: number;
    nightStartHour?: number;
    includedMeters?: number;
    stepMeters?: number;
    stepPrice?: number;
    perKm?: number;
    acSurcharge?: number;
    trunkSurcharge?: number;
    petsSurcharge?: number;
  }
) {
  return apiRequest<{ ok: true; pricing: any }>({
    method: "PUT",
    path: `/admin/pricing/${input.serviceType}`,
    token,
    body: {
      baseFare: input.baseFare,
      nightBaseFare: input.nightBaseFare ?? 0,
      nightStartHour: input.nightStartHour ?? 20,
      perKm: input.perKm ?? 0,
      includedMeters: input.includedMeters ?? 0,
      stepMeters: input.stepMeters ?? 0,
      stepPrice: input.stepPrice ?? 0,
      acSurcharge: input.acSurcharge ?? 0,
      trunkSurcharge: input.trunkSurcharge ?? 0,
      petsSurcharge: input.petsSurcharge ?? 0,
    },
  });
}

export function apiAdminSendPasswordResetWhatsapp(token: string, input: { resetRequestId: string }) {
  return apiRequest<{ ok: true; whatsappLink: string }>({
    method: "POST",
    path: `/admin/password-resets/${input.resetRequestId}/send-whatsapp`,
    token,
  });
}
