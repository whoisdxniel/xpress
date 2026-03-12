import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../theme/colors";
import { MapPreviewModal } from "./MapPreviewModal";

type Point = { lat: number; lng: number };

function computeRegion(a: Point, b: Point): Region {
  const minLat = Math.min(a.lat, b.lat);
  const maxLat = Math.max(a.lat, b.lat);
  const minLng = Math.min(a.lng, b.lng);
  const maxLng = Math.max(a.lng, b.lng);

  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;

  const latDelta = Math.max(0.002, (maxLat - minLat) * 1.8);
  const lngDelta = Math.max(0.002, (maxLng - minLng) * 1.8);

  return { latitude, longitude, latitudeDelta: latDelta, longitudeDelta: lngDelta };
}

export function MiniMeetMap(props: {
  driver: Point;
  passenger: Point;
  height?: number;
  driverIconName?: keyof typeof Ionicons.glyphMap;
  passengerIconName?: keyof typeof Ionicons.glyphMap;
}) {
  const height = props.height ?? 130;
  const [previewVisible, setPreviewVisible] = useState(false);

  const region = useMemo(
    () => computeRegion(props.driver, props.passenger),
    [props.driver.lat, props.driver.lng, props.passenger.lat, props.passenger.lng]
  );

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        rotateEnabled
        scrollEnabled
        zoomEnabled
        pitchEnabled={false}
        toolbarEnabled={false}
      >
        <Marker coordinate={{ latitude: props.passenger.lat, longitude: props.passenger.lng }}>
          <View style={[styles.pin, styles.pinPassenger]}>
            <Ionicons name={props.passengerIconName ?? "person"} size={14} color={colors.text} />
            <Text style={styles.pinText}>Cliente</Text>
          </View>
        </Marker>

        <Marker coordinate={{ latitude: props.driver.lat, longitude: props.driver.lng }}>
          <View style={[styles.pin, styles.pinDriver]}>
            <Ionicons name={props.driverIconName ?? "car"} size={14} color={colors.text} />
            <Text style={styles.pinText}>Tú</Text>
          </View>
        </Marker>
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
        title="Ubicaciones"
        markers={[
          {
            id: "passenger",
            coordinate: { latitude: props.passenger.lat, longitude: props.passenger.lng },
            title: "Cliente",
            pinColor: colors.gold,
          },
          {
            id: "driver",
            coordinate: { latitude: props.driver.lat, longitude: props.driver.lng },
            title: "Tú",
            pinColor: colors.text,
          },
        ]}
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
  pin: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pinDriver: {
    backgroundColor: colors.card,
  },
  pinPassenger: {
    backgroundColor: colors.card,
  },
  pinText: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 12,
  },
  pressed: {
    opacity: 0.85,
  },
});
