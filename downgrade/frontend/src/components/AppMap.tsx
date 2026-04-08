import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import MapboxGL from "@rnmapbox/maps";

import { forceFallbackMapStyle, getCachedMapStyleMode, getFallbackMapStyleJSON, resolveMapStyleMode, type MapStyleMode } from "../config/mapbox";
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

export type AppMapPolygon = {
  id: string;
  geojson: unknown;
  fillColor?: string;
  fillOpacity?: number;
  lineColor?: string;
  lineOpacity?: number;
  lineWidth?: number;
};

export type AppMapRef = {
  fitToCoordinates: (coords: LatLng[], opts?: FitToCoordinatesOptions) => void;
  animateToRegion: (region: Region, durationMs?: number) => void;
};

const FALLBACK_MAX_ZOOM = 19;

type Props = {
  style?: any;
  initialRegion: Region;
  interactive?: boolean;
  showUserLocation?: boolean;
  rotateEnabled?: boolean;
  pitchEnabled?: boolean;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  onPress?: (coordinate: LatLng) => void;
  onUserGesture?: () => void;
  onMapReady?: () => void;
  markers?: AppMapMarker[];
  polyline?: AppMapPolyline | null;
  polygons?: AppMapPolygon[];
};

function normalizeGeoJsonToFeature(shape: unknown) {
  const s: any = shape;
  if (!s || typeof s !== "object") return null;

  if (s.type === "Feature") return s;
  if (s.type === "FeatureCollection") return s;

  // Geometry (Polygon/MultiPolygon)
  if (typeof s.type === "string" && s.coordinates) {
    return { type: "Feature" as const, geometry: s, properties: {} };
  }

  return null;
}

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
  const lastGestureLogAtRef = useRef<number>(0);
  const [styleMode, setStyleMode] = useState<MapStyleMode>(() => getCachedMapStyleMode());

  const interactive = props.interactive ?? true;
  const showUserLocation = props.showUserLocation ?? false;
  const useFallbackStyle = styleMode === "fallback";
  const maxZoomLevel = useFallbackStyle ? FALLBACK_MAX_ZOOM : 22;
  const rotateEnabled = interactive ? (props.rotateEnabled ?? true) : false;
  const pitchEnabled = interactive ? (props.pitchEnabled ?? false) : false;
  const scrollEnabled = interactive ? (props.scrollEnabled ?? true) : false;
  const zoomEnabled = interactive ? (props.zoomEnabled ?? true) : false;

  useEffect(() => {
    let alive = true;

    void resolveMapStyleMode().then((nextMode) => {
      if (!alive) return;
      setStyleMode(nextMode);
    });

    return () => {
      alive = false;
    };
  }, []);

  const defaultSettings = useMemo(() => {
    return {
      centerCoordinate: [props.initialRegion.longitude, props.initialRegion.latitude] as [number, number],
      zoomLevel: clamp(zoomFromRegion(props.initialRegion), 0, maxZoomLevel),
    };
  }, [maxZoomLevel, props.initialRegion.latitude, props.initialRegion.longitude, props.initialRegion.latitudeDelta, props.initialRegion.longitudeDelta]);

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

    const zoomLevel = clamp(zoomFromRegion(region), 0, maxZoomLevel);
    cameraRef.current?.setCamera({
      type: "CameraStop",
      centerCoordinate: [region.longitude, region.latitude],
      zoomLevel,
      animationDuration: typeof durationMs === "number" ? durationMs : 450,
      animationMode: "easeTo",
    } as any);
  }, [maxZoomLevel]);

  useImperativeHandle(ref, () => ({ fitToCoordinates, animateToRegion }), [fitToCoordinates, animateToRegion]);

  const onMapPress = useCallback(
    (feature: any) => {
      const now = Date.now();
      if (now - lastMarkerTapAtRef.current < 250) return;

      const coords = feature?.geometry?.coordinates;
      const lng = Array.isArray(coords) ? coords[0] : null;
      const lat = Array.isArray(coords) ? coords[1] : null;
      if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return;

      if (__DEV__ && Platform.OS === "ios") {
        console.warn("[AppMap] onPress", { latitude: lat, longitude: lng });
      }

      props.onPress?.({ latitude: lat, longitude: lng });
    },
    [props]
  );

  const gestureSettings = useMemo(
    () => ({
      panEnabled: scrollEnabled,
      pinchPanEnabled: scrollEnabled,
      pinchZoomEnabled: zoomEnabled,
      doubleTapToZoomInEnabled: zoomEnabled,
      doubleTouchToZoomOutEnabled: zoomEnabled,
      quickZoomEnabled: zoomEnabled,
      rotateEnabled,
      pitchEnabled,
      simultaneousRotateAndPinchZoomEnabled: rotateEnabled && zoomEnabled,
    }),
    [pitchEnabled, rotateEnabled, scrollEnabled, zoomEnabled]
  );

  const onCameraChanged = useCallback(
    (state: { gestures?: { isGestureActive?: boolean } } | undefined) => {
      if (!interactive) return;
      if (!state?.gestures?.isGestureActive) return;

       if (__DEV__ && Platform.OS === "ios") {
        const now = Date.now();
        if (now - lastGestureLogAtRef.current > 1200) {
          lastGestureLogAtRef.current = now;
          console.warn("[AppMap] gesture active", state?.gestures ?? {});
        }
      }

      props.onUserGesture?.();
    },
    [interactive, props]
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
      styleURL={useFallbackStyle ? undefined : MapboxGL.StyleURL.Street}
      styleJSON={useFallbackStyle ? getFallbackMapStyleJSON() : undefined}
      rotateEnabled={rotateEnabled}
      pitchEnabled={pitchEnabled}
      scrollEnabled={scrollEnabled}
      zoomEnabled={zoomEnabled}
      gestureSettings={gestureSettings as any}
      onPress={onMapPress as any}
      onCameraChanged={onCameraChanged as any}
      onDidFinishLoadingMap={() => {
        if (__DEV__ && Platform.OS === "ios") {
          console.warn("[AppMap] map ready", {
            interactive,
            showUserLocation,
            useFallbackStyle,
            zoomEnabled,
            scrollEnabled,
          });
        }
        props.onMapReady?.();
      }}
      onMapLoadingError={() => {
        if (useFallbackStyle) return;
        forceFallbackMapStyle();
        setStyleMode("fallback");
      }}
      pointerEvents={interactive ? "auto" : "none"}
    >
      <MapboxGL.Camera ref={cameraRef} defaultSettings={defaultSettings as any} maxZoomLevel={maxZoomLevel} />

      {showUserLocation ? <MapboxGL.LocationPuck visible puckBearing="heading" puckBearingEnabled pulsing="default" /> : null}

      {(props.polygons || [])
        .filter((p) => p && p.id && p.geojson)
        .map((p) => {
          const feature = normalizeGeoJsonToFeature(p.geojson);
          if (!feature) return null;

          const id = String(p.id);
          const fillColor = p.fillColor ?? colors.gold;
          const lineColor = p.lineColor ?? colors.gold;
          const fillOpacity = typeof p.fillOpacity === "number" ? p.fillOpacity : 0.12;
          const lineOpacity = typeof p.lineOpacity === "number" ? p.lineOpacity : 0.5;
          const lineWidth = typeof p.lineWidth === "number" ? p.lineWidth : 2;

          return (
            <MapboxGL.ShapeSource key={id} id={`poly-${id}`} shape={feature as any}>
              <MapboxGL.FillLayer
                id={`poly-${id}-fill`}
                style={{
                  fillColor,
                  fillOpacity,
                }}
              />
              <MapboxGL.LineLayer
                id={`poly-${id}-line`}
                style={{
                  lineColor,
                  lineOpacity,
                  lineWidth,
                }}
              />
            </MapboxGL.ShapeSource>
          );
        })}

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
