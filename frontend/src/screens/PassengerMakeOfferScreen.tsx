import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppMap, type AppMapMarker, type AppMapRef, type LatLng, type Region } from "../components/AppMap";

import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { GoldTitle } from "../components/GoldTitle";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import { apiCreateOffer, apiEstimateOffer } from "../offers/offers.api";
import type { ServiceType } from "../rides/rides.types";
import { serviceTypeHasCargo, serviceTypeIconName, serviceTypeLabel } from "../utils/serviceType";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { getDrivingRoute } from "../utils/directions";
import { ensureForegroundPermission, getCurrentCoords, getFastCoords, readCachedCoords } from "../utils/location";

type Props = NativeStackScreenProps<RootStackParamList, "PassengerMakeOffer">;

type MapPoint = { lat: number; lng: number };

function regionFromCenter(center: MapPoint): Region {
  // ~100m: 0.001° lat ≈ 111m (aprox).
  return { latitude: center.lat, longitude: center.lng, latitudeDelta: 0.001, longitudeDelta: 0.001 };
}

function toLatLng(p: MapPoint): LatLng {
  return { latitude: p.lat, longitude: p.lng };
}

function money(n: number) {
  const rounded = Math.round(n * 100) / 100;
  return `$${rounded.toFixed(2)}`;
}

export function PassengerMakeOfferScreen({ navigation }: Props) {
  const auth = useAuth();
  const token = auth.token;

  const [pickup, setPickup] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoff, setDropoff] = useState<{ lat: number; lng: number } | null>(null);
  const [serviceTypeWanted, setServiceTypeWanted] = useState<ServiceType>("CARRO");

  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [routePath, setRoutePath] = useState<MapPoint[] | null>(null);

  const mapRef = useRef<AppMapRef | null>(null);
  const userInteractedRef = useRef(false);
  const shouldRecenterRef = useRef(false);
  const hasAutoCenteredRef = useRef(false);
  const pickupSeqRef = useRef(0);

  const [offeredPriceText, setOfferedPriceText] = useState<string>("");
  const offeredPriceNumber = useMemo(() => {
    const v = Number(offeredPriceText.replace(",", "."));
    if (!Number.isFinite(v)) return null;
    return v;
  }, [offeredPriceText]);

  const [loading, setLoading] = useState(true);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialCenter = useMemo(() => pickup ?? { lat: 0, lng: 0 }, [pickup]);

  useEffect(() => {
    // Centro instantáneo desde cache (no pide permisos).
    void (async () => {
      const cached = await readCachedCoords();
      if (cached && !pickup) setPickup(cached);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pickup) return;
    const canAutoCenter = !userInteractedRef.current || shouldRecenterRef.current || !hasAutoCenteredRef.current;
    if (!canAutoCenter) return;

    mapRef.current?.animateToRegion(regionFromCenter(pickup), 450);
    hasAutoCenteredRef.current = true;
    shouldRecenterRef.current = false;
  }, [pickup?.lat, pickup?.lng]);

  async function refreshPickup(opts?: { showError?: boolean; animate?: boolean }) {
    const showError = opts?.showError ?? true;
    const animate = opts?.animate ?? true;
    shouldRecenterRef.current = animate;

    const mySeq = ++pickupSeqRef.current;
    const showSpinner = !pickup;
    if (showSpinner) setLoading(true);
    setError(null);

    try {
      const ok = await ensureForegroundPermission();
      if (!ok) throw new Error("Necesitás habilitar la ubicación para crear una oferta");

      const fast = await getFastCoords();
      if (mySeq !== pickupSeqRef.current) return;
      if (fast) setPickup(fast);

      try {
        const current = await getCurrentCoords();
        if (mySeq !== pickupSeqRef.current) return;
        setPickup(current);
      } catch {
        // silencioso: con fast coords ya se puede usar.
      }
    } catch (e) {
      if (showError) {
        setError(e instanceof Error ? e.message : "No se pudo obtener tu ubicación");
      }
    } finally {
      if (showSpinner && mySeq === pickupSeqRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    if (pickup) return;
    void refreshPickup({ showError: true, animate: true });
  }, [token, pickup]);

  function requestRecenter() {
    userInteractedRef.current = false;
    shouldRecenterRef.current = true;
    hasAutoCenteredRef.current = false;
    void refreshPickup({ showError: true, animate: true });
  }

  useEffect(() => {
    // Si cambia el destino, pedimos regenerar estimado y distancia.
    setEstimatedPrice(null);
    setDistanceMeters(null);
    setOfferedPriceText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropoff?.lat, dropoff?.lng]);

  useEffect(() => {
    // Si cambia el servicio, pedimos regenerar estimado (la distancia no depende del tipo).
    setEstimatedPrice(null);
    setOfferedPriceText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceTypeWanted]);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!pickup || !dropoff) {
        setRoutePath(null);
        return;
      }

      const route = await getDrivingRoute({ from: pickup, to: dropoff });
      if (!alive) return;
      setRoutePath(route?.path?.map((p) => ({ lat: p.latitude, lng: p.longitude })) ?? null);
      if (route?.distanceMeters != null) setDistanceMeters(route.distanceMeters);
    })();

    return () => {
      alive = false;
    };
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

  const fitCoords = useMemo(() => {
    const line = pickup && dropoff ? (routePath?.length ? routePath : [pickup, dropoff]) : null;
    if (!line || line.length < 2) return null;
    const coords = line
      .filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map(toLatLng);
    return coords.length >= 2 ? coords : null;
  }, [pickup, dropoff, routePath]);

  const polyline = useMemo(() => {
    if (!pickup || !dropoff) return null;
    const line = (routePath?.length ? routePath : [pickup, dropoff]).map(toLatLng);
    return line.length >= 2
      ? {
          id: "offer-route",
          coordinates: line,
          strokeColor: colors.gold,
          strokeWidth: 4,
        }
      : null;
  }, [pickup, dropoff, routePath]);

  const markers = useMemo(() => {
    const items: AppMapMarker[] = [];
    if (pickup) items.push({ id: "pickup", coordinate: toLatLng(pickup), pinColor: colors.gold });
    if (dropoff) items.push({ id: "dropoff", coordinate: toLatLng(dropoff), pinColor: colors.text });
    return items;
  }, [pickup, dropoff]);

  useEffect(() => {
    if (!fitCoords) return;
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(fitCoords, { edgePadding: { top: 70, right: 70, bottom: 70, left: 70 }, animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, [fitCoords]);

  async function estimateNow() {
    if (!token || !pickup || !dropoff) return;

    setEstimating(true);
    setError(null);
    try {
      const res = await apiEstimateOffer(token, {
        serviceTypeWanted,
        pickup,
        dropoff,
        wantsAC: false,
        wantsTrunk: false,
        wantsPets: false,
      });

      setEstimatedPrice(res.estimatedPrice);
      setDistanceMeters(res.distanceMeters);
      setOfferedPriceText(String(res.estimatedPrice));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo estimar el precio");
    } finally {
      setEstimating(false);
    }
  }

  async function submit() {
    if (!token || !pickup || !dropoff) return;
    if (estimatedPrice == null) {
      Alert.alert("Falta estimado", "Primero generá el estimado para poder publicar la contraoferta.");
      return;
    }
    if (offeredPriceNumber == null || offeredPriceNumber <= 0) {
      Alert.alert("Precio inválido", "Ingresá un monto válido para tu contraoferta.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiCreateOffer(token, {
        serviceTypeWanted,
        pickup,
        dropoff,
        offeredPrice: offeredPriceNumber,
        searchRadiusM: 5000,
      });

      Alert.alert("Listo", "Tu contraoferta fue publicada.");
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo publicar la contraoferta");
    } finally {
      setSubmitting(false);
    }
  }

  if (auth.user?.role !== "USER") {
    return (
      <Screen>
        <Card style={{ marginTop: 16 }}>
          <Text style={{ color: colors.text, fontWeight: "900" }}>Solo disponible para clientes</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen style={{ padding: 0 }}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Ionicons name="cash-outline" size={18} color={colors.gold} />
          <GoldTitle>Hacer oferta</GoldTitle>
        </View>

        <View style={styles.topBarRight}>
          <Pressable
            style={({ pressed }) => [styles.locateBtn, pressed && styles.pressed]}
            onPress={requestRecenter}
            accessibilityRole="button"
            accessibilityLabel="Centrar en mi ubicación"
          >
            <Ionicons name="locate-outline" size={18} color={colors.gold} />
          </Pressable>

          <Pressable style={styles.closeBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.mapWrap}>
        <AppMap
          ref={(r) => {
            mapRef.current = r;
          }}
          style={StyleSheet.absoluteFill}
          initialRegion={regionFromCenter(initialCenter)}
          rotateEnabled={true}
          pitchEnabled={false}
          scrollEnabled
          zoomEnabled
          onUserGesture={() => {
            userInteractedRef.current = true;
          }}
          onPress={(c) => setDropoff({ lat: c.latitude, lng: c.longitude })}
          onMapReady={() => {
            if (fitCoords) {
              mapRef.current?.fitToCoordinates(fitCoords, { edgePadding: { top: 70, right: 70, bottom: 70, left: 70 }, animated: false });
              return;
            }

            if (!pickup) return;
            const canAutoCenter = !userInteractedRef.current || shouldRecenterRef.current || !hasAutoCenteredRef.current;
            if (!canAutoCenter) return;

            mapRef.current?.animateToRegion(regionFromCenter(pickup), 0);
            hasAutoCenteredRef.current = true;
            shouldRecenterRef.current = false;
          }}
          polyline={polyline}
          markers={markers}
        />

        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={colors.gold} />
            <Text style={styles.loadingText}>Obteniendo tu ubicación...</Text>
          </View>
        ) : null}

        {!!error ? (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.sheet}>
        <Card style={{ gap: 10 }}>
          <Text style={styles.hint}>Tocá el mapa para elegir el destino.</Text>

          <View style={styles.pillRow}>
            {(["CARRO", "MOTO", "MOTO_CARGA", "CARRO_CARGA"] as const).map((t) => {
              const active = serviceTypeWanted === t;
              const iconColor = active ? colors.gold : colors.mutedText;

              return (
                <Pressable key={t} style={[styles.pill, active ? styles.pillActive : null]} onPress={() => setServiceTypeWanted(t)}>
                  <View style={styles.pillInner}>
                    <View style={styles.pillIconWrap}>
                      <Ionicons name={serviceTypeIconName(t)} size={16} color={iconColor} />
                      {serviceTypeHasCargo(t) ? (
                        <View style={styles.pillCargoBadge}>
                          <Ionicons name="cube-outline" size={10} color={iconColor} />
                        </View>
                      ) : null}
                    </View>

                    <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{serviceTypeLabel(t)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.line}>Radio de búsqueda: 5 km</Text>

          {distanceMeters != null ? <Text style={styles.line}>Distancia estimada: {Math.round(distanceMeters)} m</Text> : null}
          {estimatedPrice != null ? <Text style={styles.line}>Precio estimado: {money(estimatedPrice)}</Text> : null}

          <SecondaryButton
            label={estimating ? "Generando..." : "Generar estimado"}
            onPress={() => void estimateNow()}
            disabled={estimating || submitting || !pickup || !dropoff}
          />

          <View style={{ gap: 8, marginTop: 6 }}>
            <Text style={styles.label}>Tu contraoferta</Text>
            <TextInput
              value={offeredPriceText}
              onChangeText={setOfferedPriceText}
              placeholder="Ej: 3000"
              placeholderTextColor={colors.mutedText}
              keyboardType="numeric"
              style={styles.input}
            />

            <View style={styles.row}>
              <SecondaryButton
                label="-100"
                onPress={() => {
                  const v = offeredPriceNumber ?? 0;
                  const next = Math.max(0, v - 100);
                  setOfferedPriceText(String(next));
                }}
                disabled={submitting}
              />
              <SecondaryButton
                label="+100"
                onPress={() => {
                  const v = offeredPriceNumber ?? 0;
                  const next = v + 100;
                  setOfferedPriceText(String(next));
                }}
                disabled={submitting}
              />
            </View>
          </View>

          <PrimaryButton
            label={submitting ? "Publicando..." : "Publicar contraoferta"}
            onPress={() => void submit()}
            disabled={
              submitting ||
              estimating ||
              estimatedPrice == null ||
              !pickup ||
              !dropoff ||
              offeredPriceNumber == null ||
              offeredPriceNumber <= 0
            }
          />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  locateBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
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
  },
  pressed: {
    opacity: 0.85,
  },
  mapWrap: {
    flex: 1,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  loadingOverlay: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    color: colors.mutedText,
    fontWeight: "700",
  },
  errorOverlay: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    backgroundColor: colors.card,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: colors.danger,
    fontWeight: "800",
  },
  sheet: {
    padding: 16,
  },
  hint: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  pill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
  },
  pillInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pillIconWrap: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pillCargoBadge: {
    position: "absolute",
    right: -6,
    top: -6,
  },
  pillActive: {
    borderColor: colors.gold,
  },
  pillText: {
    color: colors.mutedText,
    fontWeight: "900",
  },
  pillTextActive: {
    color: colors.gold,
  },
  line: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    color: colors.text,
    fontWeight: "800",
  },
});
