import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import { apiAdminListRides } from "../admin/admin.api";
import { serviceTypeLabel } from "../utils/serviceType";
import { formatDateYMD } from "../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "AdminRides">;

type RideRow = any;

export function AdminRidesScreen({ navigation }: Props) {
  const auth = useAuth();
  const token = auth.token;

  const [rides, setRides] = useState<RideRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => `Viajes (${rides.length})`, [rides.length]);

  async function load() {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiAdminListRides(token, { take: 50, skip: 0 });
      setRides(res.rides);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar viajes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Ionicons name="map-outline" size={20} color={colors.gold} />
            <Text style={styles.title}>{title}</Text>
          </View>

          <Pressable onPress={() => void load()} style={({ pressed }) => [styles.refreshBtn, pressed && styles.pressed]}>
            <Ionicons name="refresh" size={18} color={colors.gold} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centerRow}>
            <ActivityIndicator />
            <Text style={styles.muted}>Cargando...</Text>
          </View>
        ) : null}

        {!!error ? <Text style={styles.error}>{error}</Text> : null}

        {rides.map((r) => (
          <Card key={r.id} style={styles.card}>
            <Text style={styles.cardTitle}>#{String(r.id).slice(-6)}</Text>
            <Text style={styles.line}>Estado: {r.status || "—"}</Text>
            <Text style={styles.line}>Servicio: {r.serviceTypeWanted ? serviceTypeLabel(r.serviceTypeWanted) : "—"}</Text>
            <Text style={styles.line}>Asignado por admin: {r.assignedByAdmin ? "Sí" : "No"}</Text>

            <Text style={styles.line}>
              Pasajero: {r.passenger?.fullName || "—"} ({r.passenger?.user?.email || "—"})
            </Text>
            <Text style={styles.line}>
              Chofer: {r.matchedDriver?.fullName || "—"} ({r.matchedDriver?.user?.email || "—"})
            </Text>

            <Text style={styles.muted}>Creado: {formatDateYMD(r.createdAt) ?? "—"}</Text>

            {!["IN_PROGRESS", "COMPLETED", "CANCELLED", "EXPIRED"].includes(String(r.status || "")) ? (
              <View style={{ marginTop: 8 }}>
                <PrimaryButton label="Asignar en mapa" onPress={() => navigation.navigate("AdminRideAssignMap", { ride: r })} />
              </View>
            ) : null}
          </Card>
        ))}

        {!loading && rides.length === 0 ? <Text style={styles.muted}>No hay viajes.</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: 10,
    paddingBottom: 40,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
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
  centerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  muted: {
    color: colors.mutedText,
    fontSize: 13,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  card: {
    gap: 6,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  line: {
    color: colors.text,
    fontSize: 13,
  },
});
