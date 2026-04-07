import { StatusBar } from "expo-status-bar";
import { enableScreens } from "react-native-screens";
import MapboxGL from "@rnmapbox/maps";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/auth/AuthContext";
import { getMapboxAccessToken } from "./src/config/runtime";
import { AppNavigator } from "./src/navigation/AppNavigator";

enableScreens();

const mapboxToken = getMapboxAccessToken();

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
