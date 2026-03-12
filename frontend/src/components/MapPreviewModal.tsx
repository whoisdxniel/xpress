import React, { useEffect, useMemo, useRef } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, type LatLng, type Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../theme/colors";

type MarkerItem = {
  id: string;
  coordinate: LatLng;
  title: string;
  pinColor?: string;
};

function computeRegion(points: LatLng[]): Region {
  if (!points.length) {
    return { latitude: 0, longitude: 0, latitudeDelta: 60, longitudeDelta: 60 };
  }

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

export function MapPreviewModal(props: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  markers: MarkerItem[];
  polyline?: LatLng[] | null;
}) {
  const mapRef = useRef<MapView | null>(null);
  const didFitRef = useRef(false);

  const fitPoints = useMemo(() => {
    const base = props.markers.map((m) => m.coordinate);
    const line = props.polyline?.length ? props.polyline : null;
    return line?.length ? [...base, ...line] : base;
  }, [props.markers, props.polyline]);

  const initialRegion = useMemo(() => computeRegion(fitPoints), [fitPoints]);

  useEffect(() => {
    if (!props.visible) {
      didFitRef.current = false;
      return;
    }

    if (didFitRef.current) return;
    const ref = mapRef.current;
    if (!ref) return;
    if (!fitPoints.length) return;

    requestAnimationFrame(() => {
      ref.fitToCoordinates(fitPoints, {
        edgePadding: { top: 70, right: 70, bottom: 70, left: 70 },
        animated: false,
      });
    });
    didFitRef.current = true;
  }, [props.visible]);

  return (
    <Modal visible={props.visible} animationType="fade" transparent onRequestClose={props.onClose}>
      <View style={styles.backdropWrap}>
        <View style={styles.backdrop} />

        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={props.onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar mapa"
        />

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {props.title ?? "Mapa"}
            </Text>

            <Pressable
              onPress={props.onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.mapWrap}>
            <MapView
              ref={(r) => {
                mapRef.current = r;
              }}
              style={StyleSheet.absoluteFill}
              initialRegion={initialRegion}
              rotateEnabled
              pitchEnabled={false}
              toolbarEnabled={false}
            >
              {props.polyline?.length ? (
                <Polyline coordinates={props.polyline} strokeColor={colors.gold} strokeWidth={4} />
              ) : null}

              {props.markers.map((m) => (
                <Marker
                  key={m.id}
                  coordinate={m.coordinate}
                  title={m.title}
                  pinColor={m.pinColor ?? colors.gold}
                />
              ))}
            </MapView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    opacity: 0.94,
  },
  content: {
    width: "100%",
    maxWidth: 720,
    height: "78%",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  header: {
    height: 56,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginLeft: 12,
  },
  mapWrap: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  pressed: {
    opacity: 0.85,
  },
});
