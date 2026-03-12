import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/AppNavigator";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { GoldTitle } from "../components/GoldTitle";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import { apiAdminAssignRideDriver, apiAdminListDrivers } from "../admin/admin.api";
import { serviceTypeLabel } from "../utils/serviceType";

type Props = NativeStackScreenProps<RootStackParamList, "AdminRideAssignMap">;

type DriverRow = any;

type Coords = { lat: number; lng: number };

function toNum(v: any): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function haversineMeters(a: Coords, b: Coords) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function AdminRideAssignMapScreen({ route, navigation }: Props) {
  const auth = useAuth();
  const token = auth.token;

  const mapRef = useRef<MapView | null>(null);

  const ride = route.params.ride;

  const pickup = useMemo(() => {
    const lat = toNum(ride?.pickupLat);
    const lng = toNum(ride?.pickupLng);
    return { lat, lng };
  }, [ride?.pickupLat, ride?.pickupLng]);

  const serviceTypeWanted = (ride?.serviceTypeWanted ?? "CARRO") as any;

  const region: Region = useMemo(() => {
    return { latitude: pickup.lat, longitude: pickup.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 };
  }, [pickup.lat, pickup.lng]);

  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedDriver, setSelectedDriver] = useState<DriverRow | null>(null);

  const title = useMemo(() => {
    const shortId = ride?.id ? String(ride.id).slice(-6) : "—";
    return `Asignar #${shortId}`;
  }, [ride?.id]);

  async function loadDrivers() {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiAdminListDrivers(token);
      const filtered = (res.drivers ?? [])
        .filter((d: any) => d?.user?.isActive !== false)
        .filter((d: any) => !!d?.location)
        .filter((d: any) => !serviceTypeWanted || d?.serviceType === serviceTypeWanted);

      setDrivers(filtered);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar choferes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDrivers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, serviceTypeWanted]);

  async function assign() {
    if (!token) return;
    if (!ride?.id) return;
    if (!selectedDriver?.id) return;

    setAssigning(true);
    setError(null);
    try {
      await apiAdminAssignRideDriver(token, { rideId: ride.id, driverId: selectedDriver.id });
      Alert.alert("Listo", "Chofer asignado.");
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo asignar el chofer");
    } finally {
      setAssigning(false);
    }
  }

  const selectedDistance = useMemo(() => {
    if (!selectedDriver?.location) return null;
    const dpos = { lat: toNum(selectedDriver.location.lat), lng: toNum(selectedDriver.location.lng) };
    return Math.round(haversineMeters(pickup, dpos));
  }, [pickup, selectedDriver?.location]);

  return (
    <Screen style={{ padding: 0 }}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Ionicons name="pin-outline" size={18} color={colors.gold} />
          <GoldTitle>{title}</GoldTitle>
        </View>

        <Pressable onPress={() => void loadDrivers()} style={({ pressed }) => [styles.refreshBtn, pressed && styles.pressed]}>
          <Ionicons name="refresh" size={18} color={colors.gold} />
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
        >
          <Marker
            coordinate={{ latitude: pickup.lat, longitude: pickup.lng }}
            title="Punto de recogida"
            description={ride?.pickupAddress ? String(ride.pickupAddress) : undefined}
            pinColor={colors.gold}
          />

          {drivers.map((d: any) => {
            const lat = toNum(d.location?.lat);
            const lng = toNum(d.location?.lng);
            if (!lat || !lng) return null;

            const isSel = selectedDriver?.id === d.id;
            return (
              <Marker
                key={d.id}
                coordinate={{ latitude: lat, longitude: lng }}
                title={d.fullName}
                description={d.phone ? `Tel: ${d.phone}` : undefined}
                pinColor={isSel ? colors.gold : undefined}
                onPress={() => setSelectedDriver(d)}
              />
            );
          })}
        </MapView>

        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={colors.gold} />
            <Text style={styles.loadingText}>Cargando choferes...</Text>
          </View>
        ) : null}

        {!!error ? (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.sheet}>
          <Card style={{ gap: 10 }}>
            <Text style={styles.sheetTitle}>Servicio: {serviceTypeLabel(serviceTypeWanted)}</Text>
            <Text style={styles.sheetLine}>Choferes en mapa: {drivers.length}</Text>

            {selectedDriver ? (
              <View style={{ gap: 6 }}>
                <Text style={styles.sheetLine}>Seleccionado: {selectedDriver.fullName}</Text>
                <Text style={styles.sheetLine}>Tel: {selectedDriver.phone || "—"}</Text>
                {selectedDistance != null ? <Text style={styles.sheetLine}>Distancia aprox: {selectedDistance} m</Text> : null}
              </View>
            ) : (
              <Text style={styles.sheetMuted}>Toca un chofer en el mapa para seleccionarlo.</Text>
            )}

            <PrimaryButton
              label={assigning ? "Asignando..." : "Asignar chofer"}
              onPress={() => void assign()}
              disabled={!selectedDriver || assigning}
            />

            <SecondaryButton label="Volver" onPress={() => navigation.goBack()} disabled={assigning} />
          </Card>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  refreshBtn: {
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
  },
  loadingOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    color: colors.mutedText,
    fontWeight: "800",
  },
  errorOverlay: {
    position: "absolute",
    top: 66,
    left: 12,
    right: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.card,
  },
  errorText: {
    color: colors.danger,
    fontWeight: "900",
  },
  sheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
  },
  sheetTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 15,
  },
  sheetLine: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 13,
  },
  sheetMuted: {
    color: colors.mutedText,
    fontWeight: "800",
    fontSize: 13,
  },
});
