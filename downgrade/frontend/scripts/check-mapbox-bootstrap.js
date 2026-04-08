const fs = require("fs");
const path = require("path");

const { RUNTIME_ENV_FILE_CANDIDATES, readPublicRuntimeEnv, syncRuntimeBuildEnvFile } = require("./sync-runtime-public-env");

function asTruthyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function safeRequire(modulePath) {
  try {
    delete require.cache[require.resolve(modulePath)];
    return require(modulePath);
  } catch {
    return null;
  }
}

function readRuntimeBuildEnv(projectRoot) {
  const runtimePath = path.join(projectRoot, "src", "config", "runtimeBuildEnv.ts");
  if (!fs.existsSync(runtimePath)) {
    return { exists: false, hasMapbox: false };
  }

  const raw = fs.readFileSync(runtimePath, "utf8");
  return {
    exists: true,
    hasMapbox: /EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN:\s*"pk\./.test(raw),
  };
}

function main() {
  const projectRoot = path.join(__dirname, "..");
  syncRuntimeBuildEnvFile(projectRoot);
  const envPath = path.join(projectRoot, ".env");
  const envLocalPath = path.join(projectRoot, ".env.local");
  const envAliasPath = path.join(projectRoot, "env");
  const envLocalAliasPath = path.join(projectRoot, "env.local");
  const publicEnv = readPublicRuntimeEnv(projectRoot);
  const runtimeBuildEnv = readRuntimeBuildEnv(projectRoot);
  const appConfigFactory = safeRequire(path.join(projectRoot, "app.config.js"));
  const appConfigResult = typeof appConfigFactory === "function" ? appConfigFactory({ config: {} }) : {};
  const infoPlist = (appConfigResult && appConfigResult.ios && appConfigResult.ios.infoPlist) || {};
  const extra = (appConfigResult && appConfigResult.extra) || {};
  const detectedEnvFiles = RUNTIME_ENV_FILE_CANDIDATES.filter((fileName) => fs.existsSync(path.join(projectRoot, fileName)));
  const detectedEnvContents = detectedEnvFiles
    .map((fileName) => {
      try {
        return fs.readFileSync(path.join(projectRoot, fileName), "utf8");
      } catch {
        return "";
      }
    })
    .join("\n");

  const summary = {
    env: {
      dotEnvExists: fs.existsSync(envPath),
      dotEnvLocalExists: fs.existsSync(envLocalPath),
      envExists: fs.existsSync(envAliasPath),
      envLocalExists: fs.existsSync(envLocalAliasPath),
      detectedEnvFiles,
      hasRuntimeMapboxToken: asTruthyString(publicEnv.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN),
      hasMapboxDownloadsToken: asTruthyString(process.env.MAPBOX_DOWNLOADS_TOKEN) || /MAPBOX_DOWNLOADS_TOKEN\s*=/.test(detectedEnvContents),
    },
    generatedRuntime: runtimeBuildEnv,
    expoConfig: {
      extraHasMapboxToken: asTruthyString(extra.mapboxAccessToken) || asTruthyString(extra.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN),
      infoPlistHasMBXAccessToken: asTruthyString(infoPlist.MBXAccessToken),
      infoPlistHasMGLMapboxAccessToken: asTruthyString(infoPlist.MGLMapboxAccessToken),
    },
  };

  console.log(JSON.stringify(summary, null, 2));
}

main();