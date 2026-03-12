import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, type LatLng, type Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../theme/colors";
import { getDrivingRoute } from "../utils/directions";
import { MapPreviewModal } from "./MapPreviewModal";

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

function computeRegion(pickup: Point, dropoff: Point, route?: LatLng[] | null): Region {
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

  const latDelta = Math.max(0.002, (maxLat - minLat) * 1.8);
  const lngDelta = Math.max(0.002, (maxLng - minLng) * 1.8);

  return { latitude, longitude, latitudeDelta: latDelta, longitudeDelta: lngDelta };
}

export function MiniRouteMap(props: { pickup: Point; dropoff: Point; height?: number; routePath?: Point[] | null }) {
  const height = props.height ?? 130;

  const mapRef = useRef<MapView | null>(null);
  const didFitRef = useRef(false);

  const [route, setRoute] = useState<LatLng[] | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (Array.isArray(props.routePath) && props.routePath.length >= 2) {
        const coords = props.routePath
          .map((p) => {
            if (!p || typeof p.lat !== "number" || typeof p.lng !== "number") return null;
            return { latitude: p.lat, longitude: p.lng };
          })
          .filter(Boolean) as LatLng[];

        if (!cancelled) setRoute(coords.length >= 2 ? downsample(coords, 200) : null);
        return;
      }

      const res = await getDrivingRoute({ from: props.pickup, to: props.dropoff });
      if (cancelled) return;
      setRoute(res?.path?.length ? downsample(res.path, 200) : null);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [props.pickup.lat, props.pickup.lng, props.dropoff.lat, props.dropoff.lng, props.routePath]);

  const region = useMemo(
    () => computeRegion(props.pickup, props.dropoff, route),
    [props.pickup.lat, props.pickup.lng, props.dropoff.lat, props.dropoff.lng, route]
  );

  useEffect(() => {
    const ref = mapRef.current;
    if (!ref) return;
    if (didFitRef.current) return;
    if (!route?.length) return;

    ref.fitToCoordinates(route, {
      edgePadding: { top: 20, right: 20, bottom: 20, left: 20 },
      animated: false,
    });
    didFitRef.current = true;
  }, [route]);

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={(r) => {
          mapRef.current = r;
        }}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        rotateEnabled
        scrollEnabled
        zoomEnabled
        pitchEnabled={false}
        toolbarEnabled={false}
      >
        <Marker coordinate={{ latitude: props.pickup.lat, longitude: props.pickup.lng }}>
          <View style={[styles.badge, styles.badgeA]}>
            <Text style={styles.badgeText}>A</Text>
          </View>
        </Marker>

        <Marker coordinate={{ latitude: props.dropoff.lat, longitude: props.dropoff.lng }}>
          <View style={[styles.badge, styles.badgeB]}>
            <Text style={styles.badgeText}>B</Text>
          </View>
        </Marker>
        <Polyline
          coordinates={
            route?.length
              ? route
              : [
                  { latitude: props.pickup.lat, longitude: props.pickup.lng },
                  { latitude: props.dropoff.lat, longitude: props.dropoff.lng },
                ]
          }
          strokeColor={colors.gold}
          strokeWidth={3}
        />
      </MapView>

      <Pressable
        onPress={() => setPreviewVisible(true)}
        style={({ pressed }) => [styles.expandBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Ampliar mapa"
      >
        <Ionicons name="expand-outline" size={18} color={colors.gold} />
      </Pressable>

      <MapPreviewModal
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        title="Ruta"
        markers={[
          {
            id: "pickup",
            coordinate: { latitude: props.pickup.lat, longitude: props.pickup.lng },
            title: "A",
            pinColor: colors.gold,
          },
          {
            id: "dropoff",
            coordinate: { latitude: props.dropoff.lat, longitude: props.dropoff.lng },
            title: "B",
            pinColor: colors.text,
          },
        ]}
        polyline={
          route?.length
            ? route
            : [
                { latitude: props.pickup.lat, longitude: props.pickup.lng },
                { latitude: props.dropoff.lat, longitude: props.dropoff.lng },
              ]
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  expandBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pressed: {
    opacity: 0.85,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  badgeA: {
    borderColor: colors.gold,
  },
  badgeB: {
    borderColor: colors.border,
  },
  badgeText: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 16,
  },
});
