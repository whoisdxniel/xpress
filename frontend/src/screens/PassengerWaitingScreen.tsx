import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { GoldTitle } from "../components/GoldTitle";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { colors } from "../theme/colors";
import { buildWhatsappLink } from "../utils/whatsapp";
import { useAuth } from "../auth/AuthContext";
import { apiGetRideById } from "../rides/rides.api";
import { MiniMeetMap } from "../components/MiniMeetMap";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "PassengerWaiting">;

function getOperatorPhone() {
  const fromEnv = process.env.EXPO_PUBLIC_OPERATOR_PHONE;
  return (fromEnv && fromEnv.trim()) || "04245687814";
}

export function PassengerWaitingScreen({ route, navigation }: Props) {
  const auth = useAuth();
  const token = auth.token;
  const { rideId, driverName } = route.params;

  const [driverPhone, setDriverPhone] = useState<string | null>(null);
  const [driverPhoneLoading, setDriverPhoneLoading] = useState(false);

  const [pickup, setPickup] = useState<{ lat: number; lng: number; address?: string | null } | null>(null);
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number; updatedAt?: string } | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);

  const firstLoadRef = useRef(true);

  const operatorPhone = useMemo(() => getOperatorPhone(), []);
  const operatorLink = useMemo(() => {
    return buildWhatsappLink({
      phone: operatorPhone,
      text: `Hola, necesito ayuda con mi solicitud (${rideId}).`,
    });
  }, [operatorPhone, rideId]);

  const driverLink = useMemo(() => {
    if (!driverPhone) return null;
    return buildWhatsappLink({
      phone: driverPhone,
      text: `Hola ${driverName}, soy el cliente. Estoy en espera del servicio (${rideId}).`,
    });
  }, [driverPhone, driverName, rideId]);

  async function openOperator() {
    await Linking.openURL(operatorLink);
  }

  async function openDriver() {
    if (!driverLink) return;
    await Linking.openURL(driverLink);
  }

  useEffect(() => {
    const tokenStr = token;
    if (!tokenStr) return;
    let alive = true;

    async function refresh(tokenForReq: string) {
      const showSpinner = firstLoadRef.current;
      if (showSpinner) setDriverPhoneLoading(true);
      try {
        const res = await apiGetRideById(tokenForReq, { rideId });
        if (!alive) return;

        const phone = res.ride?.matchedDriver?.phone ?? null;
        setDriverPhone(phone);

        const pickupLat = Number(res.ride?.pickupLat);
        const pickupLng = Number(res.ride?.pickupLng);
        if (Number.isFinite(pickupLat) && Number.isFinite(pickupLng)) {
          setPickup({
            lat: pickupLat,
            lng: pickupLng,
            address: (res.ride?.pickupAddress as string | null | undefined) ?? null,
          });
        }

        const dLat = Number(res.ride?.matchedDriver?.location?.lat);
        const dLng = Number(res.ride?.matchedDriver?.location?.lng);
        if (Number.isFinite(dLat) && Number.isFinite(dLng)) {
          setDriverLoc({
            lat: dLat,
            lng: dLng,
            updatedAt: res.ride?.matchedDriver?.location?.updatedAt,
          });
        }

        const dist = Number(res.ride?.distanceMeters);
        setDistanceMeters(Number.isFinite(dist) ? dist : null);

        const price = Number(res.ride?.estimatedPrice ?? res.ride?.agreedPrice);
        setEstimatedPrice(Number.isFinite(price) ? price : null);
      } catch {
        if (!alive) return;
        setDriverPhone(null);
      } finally {
        if (!alive) return;
        if (showSpinner) setDriverPhoneLoading(false);
        firstLoadRef.current = false;
      }
    }

    void refresh(tokenStr);
    const t = setInterval(() => {
      void refresh(tokenStr);
    }, 3500);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [token, rideId]);

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Ionicons name="time-outline" size={20} color={colors.gold} />
        <GoldTitle>En espera</GoldTitle>
      </View>

      <Card style={{ marginTop: 16, gap: 10 }}>
        <Text style={styles.title}>Tu solicitud fue enviada</Text>
        <Text style={styles.text}>Ejecutivo seleccionado: {driverName}</Text>
        <Text style={styles.text}>ID solicitud: {rideId}</Text>
        <Text style={styles.textMuted}>
          Si necesitás ayuda, podés hablar con ZOE por WhatsApp.
        </Text>

        {pickup && driverLoc ? (
          <View style={{ marginTop: 6 }}>
            <MiniMeetMap
              height={150}
              passenger={{ lat: pickup.lat, lng: pickup.lng }}
              driver={{ lat: driverLoc.lat, lng: driverLoc.lng }}
              driverIconName="car"
              passengerIconName="person"
            />
          </View>
        ) : null}

        <View style={styles.bigRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bigLabel}>Distancia</Text>
            <Text style={styles.bigValue}>{distanceMeters != null ? `${Math.round(distanceMeters)} m` : "-"}</Text>
          </View>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={styles.bigLabel}>Monto</Text>
            <Text style={styles.bigValue}>{estimatedPrice != null ? `$${Number(estimatedPrice).toFixed(2)}` : "-"}</Text>
          </View>
        </View>

        <View style={styles.approxRow}>
          <Ionicons name="information-circle-outline" size={16} color={colors.mutedText} />
          <Text style={styles.approxText}>
            Distancia <Ionicons name="navigate-outline" size={14} color={colors.mutedText} /> y monto{" "}
            <Ionicons name="cash-outline" size={14} color={colors.mutedText} /> son aproximados. El taxímetro define el valor real.
          </Text>
        </View>

        {pickup?.address ? <Text style={styles.text}>Salida: {pickup.address}</Text> : null}

        <View style={{ height: 6 }} />

        <PrimaryButton label="Volver al inicio" onPress={() => navigation.popToTop()} />
        <SecondaryButton label="Hablar con ZOE" onPress={() => void openOperator()} />

        <View style={{ height: 10 }} />

        <Pressable
          onPress={() => void openDriver()}
          disabled={!driverLink || driverPhoneLoading}
          style={({ pressed }) => [
            styles.execBtn,
            pressed && !(!driverLink || driverPhoneLoading) ? styles.pressed : null,
            !driverLink || driverPhoneLoading ? styles.disabled : null,
          ]}
        >
          {driverPhoneLoading ? (
            <ActivityIndicator color={colors.gold} />
          ) : (
            <Ionicons name="car-outline" size={26} color={colors.gold} />
          )}
          <Text style={styles.execBtnText}>Hablar con{"\n"}Ejecutivo</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  text: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
  },
  textMuted: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
  bigRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 2,
  },
  bigLabel: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "800",
  },
  bigValue: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
  },
  approxRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  approxText: {
    flex: 1,
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  smallWarn: {
    color: colors.gold,
    fontSize: 11,
    textAlign: "center",
    fontWeight: "800",
  },
  execBtn: {
    alignSelf: "center",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: colors.text,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
  execBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 14,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});
