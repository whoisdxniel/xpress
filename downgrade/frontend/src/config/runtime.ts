import Constants from "expo-constants";

type RuntimeRecord = Record<string, unknown>;

function asRecord(value: unknown): RuntimeRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as RuntimeRecord;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function getExpoExtra(): RuntimeRecord {
  const constants = Constants as any;
  const merged: RuntimeRecord = {};
  const sources = [
    constants?.manifest?.extra,
    constants?.expoConfig?.extra,
    constants?.manifest2?.extra,
    constants?.manifest2?.extra?.expoClient?.extra,
  ];

  for (const source of sources) {
    const record = asRecord(source);
    if (!record) continue;
    Object.assign(merged, record);
  }

  return merged;
}

function getProcessEnvValue(key: string): string | null {
  const maybeProcess = typeof process !== "undefined" ? (process as any) : null;
  return normalizeString(maybeProcess?.env?.[key]);
}

function getRuntimeString(envKeys: string[], extraKeys: string[]): string | null {
  const extra = getExpoExtra();

  for (const key of envKeys) {
    const value = getProcessEnvValue(key);
    if (value) return value;
  }

  for (const key of extraKeys) {
    const value = normalizeString(extra[key]);
    if (value) return value;
  }

  return null;
}

export function getMapboxAccessToken(): string | null {
  return getRuntimeString(
    ["EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN", "MAPBOX_ACCESS_TOKEN"],
    ["mapboxAccessToken", "EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN", "MAPBOX_ACCESS_TOKEN"]
  );
}

export function getApiBaseUrlOverride(): string | null {
  return getRuntimeString(["EXPO_PUBLIC_API_BASE_URL"], ["apiBaseUrl", "EXPO_PUBLIC_API_BASE_URL"]);
}

export function getIOSPushEnabledOverride(): boolean {
  return getRuntimeString(["EXPO_PUBLIC_IOS_PUSH_ENABLED"], ["iosPushEnabled", "EXPO_PUBLIC_IOS_PUSH_ENABLED"]) === "1";
}

export function getMeterIncludedKmOverride(): number | null {
  const raw = getRuntimeString(["EXPO_PUBLIC_METER_INCLUDED_KM"], ["meterIncludedKm", "EXPO_PUBLIC_METER_INCLUDED_KM"]);
  if (!raw) return null;

  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
}

export function getOperatorPhoneOverride(): string | null {
  return getRuntimeString(["EXPO_PUBLIC_OPERATOR_PHONE"], ["operatorPhone", "EXPO_PUBLIC_OPERATOR_PHONE"]);
}

export function getOsrmBaseUrlOverride(): string | null {
  return getRuntimeString(["EXPO_PUBLIC_OSRM_BASE_URL"], ["osrmBaseUrl", "EXPO_PUBLIC_OSRM_BASE_URL"]);
}