const path = require("path");

const { syncRuntimeBuildEnvFile } = require("./sync-runtime-public-env");

syncRuntimeBuildEnvFile(path.join(__dirname, ".."));
require("./patch-react-native-ios-podspecs");