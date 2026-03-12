import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, type MapPressEvent, type Region } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";

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

type Props = NativeStackScreenProps<RootStackParamList, "PassengerMakeOffer">;

function money(n: number) {
  const rounded = Math.round(n * 100) / 100;
  return `$${rounded.toFixed(2)}`;
}

export function PassengerMakeOfferScreen({ navigation }: Props) {
  const auth = useAuth();
  const token = auth.token;

  const mapRef = useRef<MapView | null>(null);

  const [pickup, setPickup] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoff, setDropoff] = useState<{ lat: number; lng: number } | null>(null);
  const [serviceTypeWanted, setServiceTypeWanted] = useState<ServiceType>("CARRO");

  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [routePath, setRoutePath] = useState<{ latitude: number; longitude: number }[] | null>(null);

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

  const region: Region = useMemo(() => {
    const lat = pickup?.lat ?? -34.4477;
    const lng = pickup?.lng ?? -58.5584;
    return { latitude: lat, longitude: lng, latitudeDelta: 0.03, longitudeDelta: 0.03 };
  }, [pickup?.lat, pickup?.lng]);

  useEffect(() => {
    let alive = true;
    if (!token) return;
    if (pickup) return;

    (async () => {
      setError(null);
      setLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") throw new Error("Necesitás habilitar la ubicación para crear una oferta");

        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!alive) return;
        const coords = pos.coords;
        setPickup({ lat: coords.latitude, lng: coords.longitude });
        mapRef.current?.animateToRegion(
          { latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 },
          450
        );
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "No se pudo obtener tu ubicación");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [token, pickup]);

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
      setRoutePath(route?.path ?? null);
      if (route?.distanceMeters != null) setDistanceMeters(route.distanceMeters);
    })();

    return () => {
      alive = false;
    };
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

  function onMapPress(e: MapPressEvent) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setDropoff({ lat: latitude, lng: longitude });
  }

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

        <Pressable style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={18} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.mapWrap}>
        <MapView
          ref={(r) => {
            mapRef.current = r;
          }}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          initialRegion={region}
          onPress={onMapPress}
        >
          {pickup ? <Marker coordinate={{ latitude: pickup.lat, longitude: pickup.lng }} title="Salida" pinColor={colors.gold} /> : null}
          {dropoff ? <Marker coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }} title="Destino" /> : null}
          {pickup && dropoff ? (
            <Polyline
              coordinates={
                routePath?.length
                  ? routePath
                  : [
                      { latitude: pickup.lat, longitude: pickup.lng },
                      { latitude: dropoff.lat, longitude: dropoff.lng },
                    ]
              }
              strokeWidth={4}
              strokeColor={colors.gold}
            />
          ) : null}
        </MapView>

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
