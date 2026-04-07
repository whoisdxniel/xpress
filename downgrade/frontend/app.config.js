// Dynamic Expo config to allow env-based overrides (keeps app.json as source of truth).
// iOS-only native extras live here so the static config does not break when optional files are absent.

const fs = require("fs");
const path = require("path");
const appJson = require("./app.json");

function normalizeEnvValue(rawValue) {
  if (typeof rawValue !== "string") return "";

  let value = rawValue.trim();
  if (!value) return "";

  const hasMatchingQuotes =
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"));

  if (hasMatchingQuotes) {
    value = value.slice(1, -1);
  } else {
    value = value.replace(/\s+#.*$/, "").trim();
  }

  return value;
}

function parseEnvLine(line) {
  if (typeof line !== "string") return null;
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!match) return null;

  const [, key, rawValue] = match;
  return { key, value: normalizeEnvValue(rawValue) };
}

function loadLocalEnv(projectRoot) {
  const merged = {};
  const files = [".env", ".env.local"];

  for (const fileName of files) {
    const filePath = path.join(projectRoot, fileName);
    if (!fs.existsSync(filePath)) continue;

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      merged[parsed.key] = parsed.value;
    }
  }

  for (const [key, value] of Object.entries(merged)) {
    if (typeof process.env[key] === "string" && process.env[key].trim()) continue;
    process.env[key] = value;
  }
}

loadLocalEnv(__dirname);

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

    baseConfig.ios = {
      ...(baseConfig.ios || {}),
      infoPlist: {
        ...((baseConfig.ios && baseConfig.ios.infoPlist) || {}),
        MBXAccessToken: runtimeMapboxToken,
        MGLMapboxAccessToken: runtimeMapboxToken,
      },
    };
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
