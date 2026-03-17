import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { TextField } from "../components/TextField";
import { PrimaryButton } from "../components/PrimaryButton";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import {
  apiAdminGetAppConfig,
  apiAdminGetPricing,
  apiAdminUpsertPricing,
  apiAdminUpdateAppConfig,
} from "../admin/admin.api";
import type { ServiceType } from "../admin/admin.api";
import { serviceTypeIconName, serviceTypeLabel } from "../utils/serviceType";

type Props = NativeStackScreenProps<RootStackParamList, "AdminSettings">;

function parseNumber(input: string) {
  const s = String(input ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".");
  if (!s) return NaN;
  return Number(s);
}

function parseIntSafe(input: string) {
  const s = String(input ?? "").trim();
  if (!s) return NaN;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : NaN;
}

export function AdminSettingsScreen({ navigation }: Props) {
  const auth = useAuth();
  const token = auth.token;

  const [loading, setLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pricingType, setPricingType] = useState<ServiceType>("CARRO");
  const [pricingByType, setPricingByType] = useState<Record<string, any>>({});

  const [pricingBaseFare, setPricingBaseFare] = useState("0");
  const [pricingNightBaseFare, setPricingNightBaseFare] = useState("0");
  const [pricingNightStartHour, setPricingNightStartHour] = useState("20");
  const [pricingIncludedMeters, setPricingIncludedMeters] = useState("0");
  const [pricingStepMeters, setPricingStepMeters] = useState("0");
  const [pricingStepPrice, setPricingStepPrice] = useState("0");

  const [nightBaseFare, setNightBaseFare] = useState("0");
  const [nightStartHour, setNightStartHour] = useState("20");
  const [driverCreditChargePercent, setDriverCreditChargePercent] = useState("0");

  const title = useMemo(() => "Configuración global", []);

  async function load() {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const [cfgRes, pricingRes] = await Promise.all([apiAdminGetAppConfig(token), apiAdminGetPricing(token)]);

      setNightBaseFare(String(cfgRes.appConfig.nightBaseFare ?? 0));
      setNightStartHour(String(cfgRes.appConfig.nightStartHour ?? 20));
      setDriverCreditChargePercent(String(cfgRes.appConfig.driverCreditChargePercent ?? 0));

      const byType: Record<string, any> = {};
      for (const row of pricingRes.pricing ?? []) {
        if (row?.serviceType) byType[String(row.serviceType)] = row;
      }
      setPricingByType(byType);

      const current = byType[pricingType] ?? null;
      setPricingBaseFare(String(current?.baseFare ?? 0));
      setPricingNightBaseFare(String(current?.nightBaseFare ?? 0));
      setPricingNightStartHour(String(current?.nightStartHour ?? 20));
      setPricingIncludedMeters(String(current?.includedMeters ?? 0));
      setPricingStepMeters(String(current?.stepMeters ?? 0));
      setPricingStepPrice(String(current?.stepPrice ?? 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la configuración");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const current = pricingByType[pricingType] ?? null;
    setPricingBaseFare(String(current?.baseFare ?? 0));
    setPricingNightBaseFare(String(current?.nightBaseFare ?? 0));
    setPricingNightStartHour(String(current?.nightStartHour ?? 20));
    setPricingIncludedMeters(String(current?.includedMeters ?? 0));
    setPricingStepMeters(String(current?.stepMeters ?? 0));
    setPricingStepPrice(String(current?.stepPrice ?? 0));
  }, [pricingType, pricingByType]);

  async function saveConfig() {
    if (!token) return;

    const baseFare = parseNumber(pricingBaseFare);
    const nightBaseFareByType = parseNumber(pricingNightBaseFare);
    const nightStartByType = parseIntSafe(pricingNightStartHour);
    const includedMeters = parseIntSafe(pricingIncludedMeters);
    const stepMeters = parseIntSafe(pricingStepMeters);
    const stepPrice = parseNumber(pricingStepPrice);
    const nightFare = parseNumber(nightBaseFare);
    const start = parseIntSafe(nightStartHour);
    const pct = parseNumber(driverCreditChargePercent);

    if (!Number.isFinite(baseFare) || baseFare < 0) return Alert.alert("Validación", "Tarifa base inválida");
    if (!Number.isFinite(nightBaseFareByType) || nightBaseFareByType < 0)
      return Alert.alert("Validación", "Tarifa base nocturna (por tipo) inválida");
    if (!Number.isFinite(nightStartByType) || nightStartByType < 0 || nightStartByType > 23)
      return Alert.alert("Validación", "Hora inicio nocturna (por tipo) inválida (0-23)");
    if (!Number.isFinite(includedMeters) || includedMeters < 0) return Alert.alert("Validación", "Distancia incluida inválida");
    if (!Number.isFinite(stepMeters) || stepMeters < 0) return Alert.alert("Validación", "Metros por tramo inválidos");
    if (!Number.isFinite(stepPrice) || stepPrice < 0) return Alert.alert("Validación", "Precio por tramo inválido");
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return Alert.alert("Validación", "Porcentaje inválido (0-100)");
    if (!Number.isFinite(nightFare) || nightFare < 0) return Alert.alert("Validación", "Tarifa base nocturna inválida");
    if (!Number.isFinite(start) || start < 0 || start > 23) return Alert.alert("Validación", "Hora inicio nocturna inválida (0-23)");

    if (includedMeters > 0 && stepMeters <= 0) {
      return Alert.alert("Validación", "Si hay distancia incluida, definí también los metros por tramo");
    }

    setSavingConfig(true);
    setError(null);
    try {
      await apiAdminUpsertPricing(token, {
        serviceType: pricingType,
        baseFare,
        nightBaseFare: nightBaseFareByType,
        nightStartHour: nightStartByType,
        includedMeters,
        stepMeters,
        stepPrice,
        perKm: 0,
        acSurcharge: 0,
        trunkSurcharge: 0,
        petsSurcharge: 0,
      });

      await apiAdminUpdateAppConfig(token, {
        nightBaseFare: nightFare,
        nightStartHour: start,
        driverCreditChargePercent: pct,
        driverCreditChargeMode: "SERVICE_VALUE",
      });
      await load();
      Alert.alert("Listo", "Configuración guardada");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSavingConfig(false);
    }
  }

  useEffect(() => {
    void load();
    const unsub = navigation.addListener("focus", () => {
      void load();
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, navigation]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Ionicons name="settings-outline" size={20} color={colors.gold} />
            <Text style={styles.title}>{title}</Text>
          </View>

          <Pressable onPress={() => void load()} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
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

        <Card style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="pricetag-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Tarifas</Text>
          </View>

          <View style={styles.typeRow}>
            {(["CARRO", "MOTO", "MOTO_CARGA", "CARRO_CARGA"] as const).map((t) => {
              const active = pricingType === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setPricingType(t)}
                  style={({ pressed }) => [
                    styles.typeBtn,
                    active ? styles.typeBtnActive : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Ionicons name={serviceTypeIconName(t as any)} size={16} color={active ? colors.gold : colors.mutedText} />
                  <Text style={[styles.typeBtnText, { color: active ? colors.gold : colors.mutedText }]}>{serviceTypeLabel(t as any)}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextField
            label="Tarifa base"
            value={pricingBaseFare}
            onChangeText={setPricingBaseFare}
            keyboardType="number-pad"
            placeholder="Ej: 5000"
          />

          <TextField
            label="Tarifa base nocturna (este tipo)"
            value={pricingNightBaseFare}
            onChangeText={setPricingNightBaseFare}
            keyboardType="number-pad"
            placeholder="0 para usar la global"
          />

          <TextField
            label="Hora inicio nocturna (este tipo) (0-23)"
            value={pricingNightStartHour}
            onChangeText={setPricingNightStartHour}
            keyboardType="number-pad"
            placeholder="Ej: 20"
          />

          <TextField
            label="Distancia incluida (m)"
            value={pricingIncludedMeters}
            onChangeText={setPricingIncludedMeters}
            keyboardType="number-pad"
            placeholder="Ej: 3000"
          />

          <TextField
            label="Metros por tramo (m)"
            value={pricingStepMeters}
            onChangeText={setPricingStepMeters}
            keyboardType="number-pad"
            placeholder="Ej: 350"
          />

          <TextField
            label="Precio por tramo (COP)"
            value={pricingStepPrice}
            onChangeText={setPricingStepPrice}
            keyboardType="number-pad"
            placeholder="Ej: 500"
          />

          <Text style={styles.muted}>
            Se cobra: base + tramos después de la distancia incluida.
          </Text>
        </Card>

        <Card style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="moon-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Nocturno</Text>
          </View>

          <TextField
            label="Tarifa base nocturna"
            value={nightBaseFare}
            onChangeText={setNightBaseFare}
            keyboardType="number-pad"
            placeholder="0 para desactivar"
          />

          <TextField
            label="Hora inicio nocturna (0-23)"
            value={nightStartHour}
            onChangeText={setNightStartHour}
            keyboardType="number-pad"
          />

          <Text style={styles.muted}>Si la tarifa base nocturna es 0, no se aplica tarifa nocturna.</Text>
        </Card>

        <Card style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="wallet-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Comisión al chofer</Text>
          </View>

          <TextField
            label="Porcentaje global (%)"
            value={driverCreditChargePercent}
            onChangeText={setDriverCreditChargePercent}
            keyboardType="number-pad"
            placeholder="Ej: 10"
          />

          <Text style={styles.muted}>0 = no descontar. Se aplica al completar el servicio.</Text>
        </Card>

        <PrimaryButton
          label={savingConfig ? "Guardando..." : "Guardar configuración"}
          iconName="save-outline"
          onPress={() => void saveConfig()}
          disabled={savingConfig || loading}
        />
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
  iconBtn: {
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
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  typeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  typeBtnActive: {
    borderColor: colors.gold,
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: "900",
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
    fontWeight: "700",
  },
  card: {
    gap: 10,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
});
