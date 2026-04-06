// Dynamic Expo config to allow env-based overrides (keeps app.json as source of truth).
// iOS-only native extras live here so the static config does not break when optional files are absent.

const fs = require("fs");
const path = require("path");
const appJson = require("./app.json");

module.exports = ({ config }) => {
  const baseConfig = JSON.parse(JSON.stringify((appJson && appJson.expo) || config || {}));

  if (!process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN && process.env.MAPBOX_DOWNLOADS_TOKEN) {
    process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN = process.env.MAPBOX_DOWNLOADS_TOKEN;
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

  return baseConfig;
};
