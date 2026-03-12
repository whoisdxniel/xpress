import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline, type LatLng, type Region } from "react-native-maps";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/AppNavigator";
import { Screen } from "../components/Screen";
import { colors } from "../theme/colors";
import { getDrivingRoute } from "../utils/directions";

type Props = NativeStackScreenProps<RootStackParamList, "RouteMap">;

type Point = { lat: number; lng: number };

function downsample(path: LatLng[], maxPoints: number) {
  const max = Math.max(2, Math.floor(maxPoints));
  if (path.length <= max) return path;

  const stride = Math.ceil(path.length / max);
  const out: LatLng[] = [];
  for (let i = 0; i < path.length; i += stride) out.push(path[i]);

  const last = path[path.length - 1];
  const lastOut = out[out.length - 1];
  if (!lastOut || lastOut.latitude !== last.latitude || lastOut.longitude !== last.longitude) out.push(last);
  return out.length > max ? out.slice(0, max) : out;
}

function computeInitialRegion(pickup: Point, dropoff: Point, route?: LatLng[] | null): Region {
  const points = (route?.length ? route : null) ?? [
    { latitude: pickup.lat, longitude: pickup.lng },
    { latitude: dropoff.lat, longitude: dropoff.lng },
  ];

  const minLat = Math.min(...points.map((p) => p.latitude));
  const maxLat = Math.max(...points.map((p) => p.latitude));
  const minLng = Math.min(...points.map((p) => p.longitude));
  const maxLng = Math.max(...points.map((p) => p.longitude));

  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;

  const latDelta = Math.max(0.01, (maxLat - minLat) * 1.8);
  const lngDelta = Math.max(0.01, (maxLng - minLng) * 1.8);

  return { latitude, longitude, latitudeDelta: latDelta, longitudeDelta: lngDelta };
}

export function RouteMapScreen({ route: navRoute }: Props) {
  const mapRef = useRef<MapView | null>(null);

  const pickup = navRoute.params.pickup;
  const dropoff = navRoute.params.dropoff;
  const paramPath = navRoute.params.routePath;

  const [route, setRoute] = useState<LatLng[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (Array.isArray(paramPath) && paramPath.length >= 2) {
        const coords = paramPath
          .map((p) => {
            if (!p || typeof p.lat !== "number" || typeof p.lng !== "number") return null;
            return { latitude: p.lat, longitude: p.lng };
          })
          .filter(Boolean) as LatLng[];

        if (!cancelled) setRoute(coords.length >= 2 ? downsample(coords, 800) : null);
        return;
      }

      const res = await getDrivingRoute({ from: pickup, to: dropoff });
      if (cancelled) return;
      setRoute(res?.path?.length ? downsample(res.path, 800) : null);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [pickup.lat, pickup.lng, dropoff.lat, dropoff.lng, paramPath]);

  const initialRegion = useMemo(() => computeInitialRegion(pickup, dropoff, route), [pickup, dropoff, route]);

  useEffect(() => {
    if (!route?.length) return;
    const ref = mapRef.current;
    if (!ref) return;

    ref.fitToCoordinates(route, {
      edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
      animated: false,
    });
  }, [route]);

  return (
    <Screen style={{ padding: 0 }}>
      <View style={styles.wrap}>
        <MapView
          ref={(r) => {
            mapRef.current = r;
          }}
          style={StyleSheet.absoluteFill}
          initialRegion={initialRegion}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
        >
          <Marker coordinate={{ latitude: pickup.lat, longitude: pickup.lng }} pinColor={colors.gold} />
          <Marker coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }} pinColor={colors.text} />

          <Polyline
            coordinates={
              route?.length
                ? route
                : [
                    { latitude: pickup.lat, longitude: pickup.lng },
                    { latitude: dropoff.lat, longitude: dropoff.lng },
                  ]
            }
            strokeColor={colors.gold}
            strokeWidth={4}
          />
        </MapView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
