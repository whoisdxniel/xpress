const fs = require("fs");
const path = require("path");

const PUBLIC_RUNTIME_KEYS = [
  "EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN",
  "EXPO_PUBLIC_API_BASE_URL",
  "EXPO_PUBLIC_IOS_PUSH_ENABLED",
  "EXPO_PUBLIC_METER_INCLUDED_KM",
  "EXPO_PUBLIC_OPERATOR_PHONE",
  "EXPO_PUBLIC_OSRM_BASE_URL",
];

const RUNTIME_ENV_FILE_CANDIDATES = [".env", ".env.local", "env", "env.local"];

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
  const files = RUNTIME_ENV_FILE_CANDIDATES;

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

  return merged;
}

function readPublicRuntimeEnv(projectRoot) {
  const localEnv = loadLocalEnv(projectRoot);
  const result = {};

  for (const key of PUBLIC_RUNTIME_KEYS) {
    const envValue = typeof process.env[key] === "string" ? normalizeEnvValue(process.env[key]) : "";
    const localValue = typeof localEnv[key] === "string" ? normalizeEnvValue(localEnv[key]) : "";
    const value = envValue || localValue;
    result[key] = value || null;
  }

  return result;
}

function renderRuntimeBuildEnv(values) {
  const lines = [
    "export const RUNTIME_BUILD_ENV = {",
    ...PUBLIC_RUNTIME_KEYS.map((key) => `  ${key}: ${JSON.stringify(values[key] ?? null)},`),
    "} as const;",
    "",
    "export type RuntimeBuildEnvKey = keyof typeof RUNTIME_BUILD_ENV;",
    "",
  ];

  return lines.join("\n");
}

function syncRuntimeBuildEnvFile(projectRoot = path.join(__dirname, "..")) {
  const values = readPublicRuntimeEnv(projectRoot);
  const targetPath = path.join(projectRoot, "src", "config", "runtimeBuildEnv.ts");
  const nextContent = renderRuntimeBuildEnv(values);
  const currentContent = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf8") : null;

  if (currentContent === nextContent) {
    console.log("[postinstall] runtimeBuildEnv.ts ya esta sincronizado con .env.");
    return;
  }

  fs.writeFileSync(targetPath, nextContent, "utf8");
  console.log("[postinstall] runtimeBuildEnv.ts sincronizado desde .env/.env.local.");
}

if (require.main === module) {
  syncRuntimeBuildEnvFile();
}

module.exports = {
  PUBLIC_RUNTIME_KEYS,
  RUNTIME_ENV_FILE_CANDIDATES,
  normalizeEnvValue,
  parseEnvLine,
  loadLocalEnv,
  readPublicRuntimeEnv,
  syncRuntimeBuildEnvFile,
};