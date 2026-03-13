import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { GoldTitle } from "../components/GoldTitle";
import { TextField } from "../components/TextField";
import { PrimaryButton } from "../components/PrimaryButton";
import { ReadOnlyField } from "../components/ReadOnlyField";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import { apiGetMyProfile, apiUpdateMyProfile } from "../profile/profile.api";
import { getSavedPasswordForUser } from "../lib/credentials";

export function ProfileScreen() {
  const auth = useAuth();
  const token = auth.token;
  const role = auth.user?.role;
  const userId = auth.user?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [savedPassword, setSavedPassword] = useState<string | null>(null);
  const [savedPasswordLoading, setSavedPasswordLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const [driverReadonly, setDriverReadonly] = useState<any | null>(null);

  const isPassenger = role === "USER";
  const isDriver = role === "DRIVER";

  const canEditPhone = isPassenger || isDriver;
  const canEditEmail = false;

  const phoneEditable = isEditing && canEditPhone;
  const emailEditable = isEditing && canEditEmail;
  const nameEditable = isEditing;

  async function load(opts?: { showLoading?: boolean }) {
    if (!token) return;
    const showLoading = opts?.showLoading ?? true;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const res = await apiGetMyProfile(token);

      setEmail(res.profile.user.email);

      if (res.profile.passenger) {
        setFirstName(res.profile.passenger.firstName ?? "");
        setLastName(res.profile.passenger.lastName ?? "");
        setPhone(res.profile.passenger.phone ?? "");
        setDriverReadonly(null);
      }

      if (res.profile.driver) {
        setFirstName(res.profile.driver.firstName ?? "");
        setLastName(res.profile.driver.lastName ?? "");
        setPhone(res.profile.driver.phone ?? "");
        setDriverReadonly(res.profile.driver);
      }

      // Luego de una carga correcta, volvemos a modo lectura.
      setIsEditing(false);

      if (userId) {
        setSavedPasswordLoading(true);
        try {
          const pw = await getSavedPasswordForUser(userId);
          setSavedPassword(pw && pw.trim().length ? pw : null);
        } catch {
          setSavedPassword(null);
        } finally {
          setSavedPasswordLoading(false);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar tu perfil");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    void load({ showLoading: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!userId) {
        setSavedPassword(null);
        return;
      }

      setSavedPasswordLoading(true);
      try {
        const pw = await getSavedPasswordForUser(userId);
        if (!alive) return;
        setSavedPassword(pw && pw.trim().length ? pw : null);
      } catch {
        if (!alive) return;
        setSavedPassword(null);
      } finally {
        if (!alive) return;
        setSavedPasswordLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const passwordValue = useMemo(() => {
    if (savedPassword && savedPassword.trim().length) return savedPassword;
    return "********";
  }, [savedPassword]);

  async function ensurePasswordLoaded() {
    if (!userId) return null;
    if (savedPassword && savedPassword.trim().length) return savedPassword;

    setSavedPasswordLoading(true);
    try {
      const pw = await getSavedPasswordForUser(userId);
      const normalized = pw && pw.trim().length ? pw : null;
      setSavedPassword(normalized);
      return normalized;
    } catch {
      setSavedPassword(null);
      return null;
    } finally {
      setSavedPasswordLoading(false);
    }
  }

  async function save() {
    if (!token) return;

    setSaving(true);
    setError(null);

    try {
      if (isPassenger) {
        await apiUpdateMyProfile(token, {
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        });
      } else if (isDriver) {
        await apiUpdateMyProfile(token, {
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          phone: phone.trim() || undefined,
        });
      }

      Alert.alert("Listo", "Perfil actualizado.");
      await load({ showLoading: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar el perfil");
    } finally {
      setSaving(false);
    }
  }

  async function onMainButtonPress() {
    if (!isEditing) {
      setError(null);
      setIsEditing(true);
      return;
    }

    await save();
  }

  if (role === "ADMIN") {
    return (
      <Screen>
        <Card style={{ marginTop: 16 }}>
          <Text style={{ color: colors.text, fontWeight: "900" }}>El administrador no requiere perfil.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen keyboardAvoiding>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Ionicons name="people-outline" size={20} color={colors.gold} />
            <GoldTitle>Perfil</GoldTitle>
          </View>

          <Pressable
            style={[styles.refreshBtn, isEditing ? styles.refreshBtnDisabled : null]}
            onPress={isEditing ? undefined : () => void load({ showLoading: false })}
          >
            <Ionicons name="refresh" size={18} color={colors.text} />
          </Pressable>
        </View>

        {loading ? (
          <Card style={{ marginTop: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ActivityIndicator color={colors.gold} />
              <Text style={{ color: colors.mutedText, fontWeight: "800" }}>Cargando...</Text>
            </View>
          </Card>
        ) : null}

        {!!error ? (
          <Card style={{ marginTop: 16, borderColor: colors.danger, borderWidth: 1 }}>
            <Text style={{ color: colors.danger, fontWeight: "900" }}>{error}</Text>
          </Card>
        ) : null}

        <Card style={{ marginTop: 16, gap: 12 }}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="person-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Datos</Text>
          </View>

          <ReadOnlyField
            label="Usuario"
            labelIconName="at-outline"
            value={auth.user?.email ?? auth.user?.username ?? email}
            emptyText="-"
          />

          {nameEditable ? (
            <TextField
              label="Nombres"
              labelIconName="text-outline"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              editable
            />
          ) : (
            <ReadOnlyField label="Nombres" labelIconName="text-outline" value={firstName} emptyText="Sin cargar" />
          )}

          {nameEditable ? (
            <TextField
              label="Apellidos"
              labelIconName="text-outline"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              editable
            />
          ) : (
            <ReadOnlyField label="Apellidos" labelIconName="text-outline" value={lastName} emptyText="Sin cargar" />
          )}

          {phoneEditable ? (
            <TextField
              label="Teléfono"
              labelIconName="call-outline"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              editable
            />
          ) : (
            <ReadOnlyField label="Teléfono" labelIconName="call-outline" value={phone} emptyText="Sin cargar" />
          )}

          {emailEditable ? (
            <TextField
              label="Correo"
              labelIconName="mail-outline"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              editable
            />
          ) : (
            <ReadOnlyField label="Correo" labelIconName="mail-outline" value={email} emptyText="Sin cargar" />
          )}

          <TextField
            label="Contraseña"
            labelIconName="lock-closed-outline"
            value={passwordValue}
            onChangeText={() => void 0}
            secureTextEntry={!passwordVisible}
            editable={false}
            rightIconName={passwordVisible ? "eye-off-outline" : "eye-outline"}
            onPressRightIcon={() => {
              void (async () => {
                // Si está visible, siempre podemos ocultarla.
                if (passwordVisible) {
                  setPasswordVisible(false);
                  return;
                }

                // Si todavía no cargó, intentamos leerla justo ahora.
                const pw = await ensurePasswordLoaded();
                if (!pw) {
                  Alert.alert(
                    "No disponible",
                    "Para poder ver tu contraseña, cerrá sesión e ingresá nuevamente una vez.\n\n(La app no puede leer tu contraseña desde el servidor.)"
                  );
                  return;
                }

                setPasswordVisible(true);
              })();
            }}
            rightIconAccessibilityLabel={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
          />

          {savedPasswordLoading ? <Text style={[styles.readLine, { color: colors.mutedText }]}>Cargando contraseña...</Text> : null}

          <PrimaryButton
            label={isEditing ? (saving ? "Guardando..." : "Guardar") : "Editar"}
            onPress={() => void onMainButtonPress()}
            disabled={saving}
          />

          {isDriver && driverReadonly ? (
            <View style={{ marginTop: 10, gap: 10 }}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="car-outline" size={18} color={colors.gold} />
                <Text style={styles.sectionTitle}>Vehículo (solo ver)</Text>
              </View>

              <Text style={styles.readLine}>Tipo: {driverReadonly.serviceType}</Text>
              {driverReadonly.vehicle ? (
                <>
                  <Text style={styles.readLine}>Marca: {driverReadonly.vehicle.brand}</Text>
                  <Text style={styles.readLine}>Modelo: {driverReadonly.vehicle.model}</Text>
                  <Text style={styles.readLine}>Placa: {driverReadonly.vehicle.plate ?? "-"}</Text>
                  <Text style={styles.readLine}>Año: {driverReadonly.vehicle.year}</Text>
                  <Text style={styles.readLine}>Color: {driverReadonly.vehicle.color}</Text>
                </>
              ) : (
                <Text style={styles.readLine}>Sin vehículo cargado.</Text>
              )}

              <View style={styles.sectionTitleRow}>
                <Ionicons name="image-outline" size={18} color={colors.gold} />
                <Text style={styles.sectionTitle}>Foto (solo admin)</Text>
              </View>
              <Text style={styles.readLine}>{driverReadonly.photoUrl}</Text>
            </View>
          ) : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
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
  refreshBtnDisabled: {
    opacity: 0.5,
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
  readLine: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
});
