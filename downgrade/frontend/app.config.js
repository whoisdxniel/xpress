// Dynamic Expo config to allow env-based overrides (keeps app.json as source of truth).
// iOS-only native extras live here so the static config does not break when optional files are absent.

const fs = require("fs");
const path = require("path");
const appJson = require("./app.json");

function readEnvValue(...keys) {
  for (const key of keys) {
    const raw = process.env[key];
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function assignExtraValues(target, keys, value) {
  for (const key of keys) {
    target[key] = value;
  }
}

module.exports = ({ config }) => {
  const baseConfig = JSON.parse(JSON.stringify((appJson && appJson.expo) || config || {}));
  const extra = {
    ...(baseConfig.extra || {}),
  };

  if (!process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN && process.env.MAPBOX_DOWNLOADS_TOKEN) {
    process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN = process.env.MAPBOX_DOWNLOADS_TOKEN;
  }

  const runtimeMapboxToken = readEnvValue("EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN", "MAPBOX_ACCESS_TOKEN");
  if (runtimeMapboxToken) {
    assignExtraValues(extra, ["mapboxAccessToken", "EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN", "MAPBOX_ACCESS_TOKEN"], runtimeMapboxToken);
  }

  const publicRuntimeValues = [
    {
      envKeys: ["EXPO_PUBLIC_API_BASE_URL"],
      extraKeys: ["apiBaseUrl", "EXPO_PUBLIC_API_BASE_URL"],
    },
    {
      envKeys: ["EXPO_PUBLIC_IOS_PUSH_ENABLED"],
      extraKeys: ["iosPushEnabled", "EXPO_PUBLIC_IOS_PUSH_ENABLED"],
    },
    {
      envKeys: ["EXPO_PUBLIC_METER_INCLUDED_KM"],
      extraKeys: ["meterIncludedKm", "EXPO_PUBLIC_METER_INCLUDED_KM"],
    },
    {
      envKeys: ["EXPO_PUBLIC_OPERATOR_PHONE"],
      extraKeys: ["operatorPhone", "EXPO_PUBLIC_OPERATOR_PHONE"],
    },
    {
      envKeys: ["EXPO_PUBLIC_OSRM_BASE_URL"],
      extraKeys: ["osrmBaseUrl", "EXPO_PUBLIC_OSRM_BASE_URL"],
    },
  ];

  for (const entry of publicRuntimeValues) {
    const value = readEnvValue(...entry.envKeys);
    if (!value) continue;
    assignExtraValues(extra, entry.extraKeys, value);
  }

  const googleServiceCandidates = [
    {
      absolutePath: path.join(__dirname, "GoogleService-Info.plist"),
      relativePath: "./GoogleService-Info.plist",
    },
    {
      absolutePath: path.join(__dirname, "..", "GoogleService-Info.plist"),
      relativePath: "../GoogleService-Info.plist",
    },
  ];

  const googleServiceInfoFile = googleServiceCandidates.find((candidate) =>
    fs.existsSync(candidate.absolutePath)
  );

  if (googleServiceInfoFile) {
    baseConfig.ios = {
      ...(baseConfig.ios || {}),
      googleServicesFile: googleServiceInfoFile.relativePath,
    };
  }

  baseConfig.extra = extra;

  return baseConfig;
};
