// Dynamic Expo config to allow env-based overrides (keeps app.json as source of truth).
// iOS-only native extras live here so the static config does not break when optional files are absent.

const fs = require("fs");
const path = require("path");
const appJson = require("./app.json");

function envFlagEnabled(value, defaultValue = false) {
  if (value == null) return defaultValue;

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return defaultValue;

  return !["0", "false", "no", "off"].includes(normalized);
}

function upsertPluginOptions(plugins, pluginName, updateOptions) {
  let found = false;

  const nextPlugins = (plugins || []).map((entry) => {
    if (Array.isArray(entry) && entry[0] === pluginName) {
      found = true;
      const currentOptions = entry[1] && typeof entry[1] === "object" ? entry[1] : {};
      return [pluginName, updateOptions(currentOptions)];
    }

    if (entry === pluginName) {
      found = true;
      return [pluginName, updateOptions({})];
    }

    return entry;
  });

  if (!found) {
    nextPlugins.push([pluginName, updateOptions({})]);
  }

  return nextPlugins;
}

module.exports = ({ config }) => {
  const baseConfig = JSON.parse(JSON.stringify((appJson && appJson.expo) || config || {}));
  const iosPushEnabled = envFlagEnabled(process.env.EXPO_PUBLIC_IOS_PUSH_ENABLED, true);

  if (!process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN && process.env.MAPBOX_DOWNLOADS_TOKEN) {
    process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN = process.env.MAPBOX_DOWNLOADS_TOKEN;
  }

  const googleServiceCandidates = [
    {
      absolutePath: process.env.GOOGLE_SERVICE_INFO_PLIST,
      configPath: process.env.GOOGLE_SERVICE_INFO_PLIST,
    },
    {
      absolutePath: path.join(__dirname, "GoogleService-Info.plist"),
      configPath: "./GoogleService-Info.plist",
    },
    {
      absolutePath: path.join(__dirname, "..", "GoogleService-Info.plist"),
      configPath: "../GoogleService-Info.plist",
    },
  ];

  const googleServiceInfoFile = googleServiceCandidates.find((candidate) =>
    candidate.absolutePath && fs.existsSync(candidate.absolutePath)
  );

  if (googleServiceInfoFile) {
    baseConfig.ios = {
      ...(baseConfig.ios || {}),
      googleServicesFile: googleServiceInfoFile.configPath,
    };
  }

  baseConfig.plugins = upsertPluginOptions(baseConfig.plugins, "expo-notifications", (options) => ({
    ...options,
    enableBackgroundRemoteNotifications: iosPushEnabled,
  }));

  return baseConfig;
};
