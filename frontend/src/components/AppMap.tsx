import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import MapboxGL from "@rnmapbox/maps";

import { colors } from "../theme/colors";

export type LatLng = { latitude: number; longitude: number };
export type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
export type EdgePadding = { top: number; right: number; bottom: number; left: number };

export type FitToCoordinatesOptions = {
  edgePadding?: EdgePadding;
  animated?: boolean;
};

export type AppMapMarker = {
  id: string;
  coordinate: LatLng;
  title?: string;
  pinColor?: string;
  onPress?: () => void;
  children?: React.ReactElement;
};

export type AppMapPolyline = {
  id?: string;
  coordinates: LatLng[];
  strokeColor?: string;
  strokeWidth?: number;
};

export type AppMapRef = {
  fitToCoordinates: (coords: LatLng[], opts?: FitToCoordinatesOptions) => void;
  animateToRegion: (region: Region, durationMs?: number) => void;
};

type Props = {
  style?: any;
  initialRegion: Region;
  interactive?: boolean;
  rotateEnabled?: boolean;
  pitchEnabled?: boolean;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  onPress?: (coordinate: LatLng) => void;
  onUserGesture?: () => void;
  onMapReady?: () => void;
  markers?: AppMapMarker[];
  polyline?: AppMapPolyline | null;
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function zoomFromRegion(r: Region): number {
  const delta = isFiniteNumber(r.longitudeDelta) && r.longitudeDelta > 0 ? r.longitudeDelta : 0.03;
  const z = Math.log2(360 / delta);
  return clamp(z, 0, 22);
}

function toPosition(c: LatLng): [number, number] {
  return [c.longitude, c.latitude];
}

export const AppMap = forwardRef<AppMapRef, Props>(function AppMap(props, ref) {
  const cameraRef = useRef<any>(null);
  const lastMarkerTapAtRef = useRef<number>(0);

  const interactive = props.interactive ?? true;

  const defaultSettings = useMemo(() => {
    return {
      centerCoordinate: [props.initialRegion.longitude, props.initialRegion.latitude] as [number, number],
      zoomLevel: zoomFromRegion(props.initialRegion),
    };
  }, [props.initialRegion.latitude, props.initialRegion.longitude, props.initialRegion.latitudeDelta, props.initialRegion.longitudeDelta]);

  const fitToCoordinates = useCallback<AppMapRef["fitToCoordinates"]>((coords, opts) => {
    const points = (coords || [])
      .filter((c) => c && isFiniteNumber(c.latitude) && isFiniteNumber(c.longitude))
      .map(toPosition);

    if (points.length < 2) return;

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (const [lng, lat] of points) {
      if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) continue;
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    }

    if (!Number.isFinite(minLat) || !Number.isFinite(maxLat) || !Number.isFinite(minLng) || !Number.isFinite(maxLng)) return;

    const ne: [number, number] = [maxLng, maxLat];
    const sw: [number, number] = [minLng, minLat];

    const edge = opts?.edgePadding;
    const padding: number[] | number = edge ? [edge.top, edge.right, edge.bottom, edge.left] : 0;
    const duration = opts?.animated === false ? 0 : 450;

    // NOTE: Mapbox expects [top, right, bottom, left] for 4-item padding arrays.
    cameraRef.current?.fitBounds(ne, sw, padding, duration);
  }, []);

  const animateToRegion = useCallback<AppMapRef["animateToRegion"]>((region, durationMs) => {
    if (!region || !isFiniteNumber(region.latitude) || !isFiniteNumber(region.longitude)) return;

    const zoomLevel = zoomFromRegion(region);
    cameraRef.current?.setCamera({
      type: "CameraStop",
      centerCoordinate: [region.longitude, region.latitude],
      zoomLevel,
      animationDuration: typeof durationMs === "number" ? durationMs : 450,
      animationMode: "easeTo",
    } as any);
  }, []);

  useImperativeHandle(ref, () => ({ fitToCoordinates, animateToRegion }), [fitToCoordinates, animateToRegion]);

  const onMapPress = useCallback(
    (feature: any) => {
      const now = Date.now();
      if (now - lastMarkerTapAtRef.current < 250) return;

      const coords = feature?.geometry?.coordinates;
      const lng = Array.isArray(coords) ? coords[0] : null;
      const lat = Array.isArray(coords) ? coords[1] : null;
      if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return;

      props.onPress?.({ latitude: lat, longitude: lng });
    },
    [props]
  );

  const lineShape = useMemo(() => {
    const poly = props.polyline;
    if (!poly?.coordinates?.length) return null;

    const coords = poly.coordinates
      .filter((c) => c && isFiniteNumber(c.latitude) && isFiniteNumber(c.longitude))
      .map((c) => [c.longitude, c.latitude]);

    if (coords.length < 2) return null;

    return {
      type: "Feature" as const,
      geometry: { type: "LineString" as const, coordinates: coords },
      properties: {},
    };
  }, [props.polyline]);

  const markerItems = useMemo(() => {
    const markers = props.markers || [];
    return markers
      .filter((m) => m && m.id && m.coordinate && isFiniteNumber(m.coordinate.latitude) && isFiniteNumber(m.coordinate.longitude))
      .map((m) => {
        const pinColor = (m.pinColor && String(m.pinColor)) || colors.gold;
        const child = m.children ?? <View style={[styles.defaultPin, { borderColor: pinColor }]} />;

        return {
          id: String(m.id),
          coordinate: [m.coordinate.longitude, m.coordinate.latitude] as [number, number],
          onPress: m.onPress,
          title: m.title,
          child,
        };
      });
  }, [props.markers]);

  return (
    <MapboxGL.MapView
      style={[StyleSheet.absoluteFill, props.style]}
      styleURL={MapboxGL.StyleURL.Street}
      rotateEnabled={interactive ? (props.rotateEnabled ?? true) : false}
      pitchEnabled={interactive ? (props.pitchEnabled ?? false) : false}
      scrollEnabled={interactive ? (props.scrollEnabled ?? true) : false}
      zoomEnabled={interactive ? (props.zoomEnabled ?? true) : false}
      onPress={onMapPress as any}
      onDidFinishLoadingMap={() => props.onMapReady?.()}
      pointerEvents={interactive ? "auto" : "none"}
      onTouchStart={() => {
        if (!interactive) return;
        props.onUserGesture?.();
      }}
      onTouchMove={() => {
        if (!interactive) return;
        props.onUserGesture?.();
      }}
    >
      <MapboxGL.Camera ref={cameraRef} defaultSettings={defaultSettings as any} />

      {lineShape ? (
        <MapboxGL.ShapeSource id={props.polyline?.id ?? "route"} shape={lineShape as any}>
          <MapboxGL.LineLayer
            id={(props.polyline?.id ?? "route") + "-line"}
            style={{
              lineColor: props.polyline?.strokeColor ?? colors.gold,
              lineWidth: props.polyline?.strokeWidth ?? 4,
              lineJoin: "round",
              lineCap: "round",
            }}
          />
        </MapboxGL.ShapeSource>
      ) : null}

      {markerItems.map((m) => (
        <MapboxGL.PointAnnotation
          key={m.id}
          id={m.id}
          coordinate={m.coordinate}
          title={m.title}
          onSelected={() => {
            lastMarkerTapAtRef.current = Date.now();
            m.onPress?.();
          }}
        >
          {m.child}
        </MapboxGL.PointAnnotation>
      ))}
    </MapboxGL.MapView>
  );
});

const styles = StyleSheet.create({
  defaultPin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: colors.gold,
    backgroundColor: colors.card,
  },
});
