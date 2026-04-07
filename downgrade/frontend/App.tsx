import { StatusBar } from "expo-status-bar";
import { enableScreens } from "react-native-screens";
import MapboxGL from "@rnmapbox/maps";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/auth/AuthContext";
import { getMapboxAccessToken } from "./src/config/runtime";
import { AppNavigator } from "./src/navigation/AppNavigator";

enableScreens();

const handledMapboxMessages = new Set<string>();
const handledMapboxFragments = [
  "No accessToken set",
  "MapLoad error",
  "HTTP status code 401",
  "HTTP status code 403",
];
const fallbackTileHeaderOptions = { urlRegexp: "^https://tile\\.openstreetmap\\.org/.*" };

const mapboxLogger = (MapboxGL as any)?.Logger;
if (typeof mapboxLogger?.setLogCallback === "function") {
  mapboxLogger.setLogCallback((log: { message?: unknown }) => {
    const message = typeof log?.message === "string" ? log.message : "";
    if (!handledMapboxFragments.some((fragment) => message.includes(fragment))) return false;

    if (!handledMapboxMessages.has(message)) {
      handledMapboxMessages.add(message);
      console.warn("Mapbox [warning]", message);
    }

    return true;
  });
}

const mapboxToken = getMapboxAccessToken();

if (typeof (MapboxGL as any)?.addCustomHeader === "function") {
  (MapboxGL as any).addCustomHeader("User-Agent", "Xpress/1.0 (com.xpress.traslados)", fallbackTileHeaderOptions);
}

if (mapboxToken) {
  MapboxGL.setAccessToken(mapboxToken);
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
