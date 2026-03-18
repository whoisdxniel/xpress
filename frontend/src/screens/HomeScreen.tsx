import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import * as Location from "expo-location";
import { Screen } from "../components/Screen";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import { Card } from "../components/Card";
import { GoldTitle } from "../components/GoldTitle";
import { MiniRouteMap } from "../components/MiniRouteMap";
import { MiniMeetMap } from "../components/MiniMeetMap";
import { Ionicons } from "@expo/vector-icons";
import { buildWhatsappLink } from "../utils/whatsapp";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { apiCancelRide, apiDriverNearbyRideRequests, apiDriverOfferRide, apiGetActiveRide, apiGetRideById, apiGetRideOffers } from "../rides/rides.api";
import {
  apiDriverAcceptRide,
  apiDriverCompleteRide,
  apiDriverNotifyArrived,
  apiDriverStartRide,
  apiDriverUpdateMeter,
  apiDriverUpsertLocation,
} from "../driver/driver.api";
import { apiCreateRating } from "../ratings/ratings.api";
import { apiCancelOffer, apiMyOffers, apiNearbyOffers } from "../offers/offers.api";
import type { NearbyOfferItem } from "../offers/offers.types";
import { serviceTypeLabel } from "../utils/serviceType";
import { rideStatusLabel, roleLabel, userDisplayName } from "../utils/labels";
import { ensureForegroundPermission, getCurrentCoords, getLastKnownCoords } from "../utils/location";
import { clearActiveRideOffersRideId, getActiveRideOffersRideId } from "../lib/storage";
import { formatCop, formatSecondaryFromCop } from "../utils/currency";

const zoeImg = require("../../assets/zoe.png");
const playstoreImg = require("../../assets/playstore.png");

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const auth = useAuth();
  const role = auth.user?.role;

  const token = auth.token;
  const [attentionRide, setAttentionRide] = useState<any | null>(null);
  const [rideLoading, setRideLoading] = useState(false);
  const [rideError, setRideError] = useState<string | null>(null);
  const [rideActionLoading, setRideActionLoading] = useState(false);
  const [notifyLoading, setNotifyLoading] = useState(false);

  const [myOffers, setMyOffers] = useState<any[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);

  const [nearbyRequests, setNearbyRequests] = useState<any[]>([]);
  const [nearbyRequestsLoading, setNearbyRequestsLoading] = useState(false);
  const [nearbyRequestsError, setNearbyRequestsError] = useState<string | null>(null);
  const [offerRideLoadingId, setOfferRideLoadingId] = useState<string | null>(null);

  const [nearbyOffers, setNearbyOffers] = useState<NearbyOfferItem[]>([]);
  const [nearbyOffersLoading, setNearbyOffersLoading] = useState(false);
  const [nearbyOffersError, setNearbyOffersError] = useState<string | null>(null);

  const [driverCoords, setDriverCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [offersRideId, setOffersRideId] = useState<string | null>(null);
  const [offersRideCount, setOffersRideCount] = useState<number>(0);
  const [offersRideLoading, setOffersRideLoading] = useState(false);

  const offersRideFirstLoadRef = useRef(true);

  const isFocused = useIsFocused();

  const meterIncludedKm = useMemo(() => {
    const raw = process.env.EXPO_PUBLIC_METER_INCLUDED_KM;
    const n = raw != null ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 3;
  }, []);

  const meterWatchRef = useRef<Location.LocationSubscription | null>(null);
  const meterLastCoordsRef = useRef<{ lat: number; lng: number; ts: number; accuracy?: number | null } | null>(null);
  const meterDistanceRef = useRef<number>(0);
  const meterRideIdRef = useRef<string | null>(null);
  const meterLastSentAtRef = useRef<number>(0);
  const meterLastSentDistanceRef = useRef<number>(0);
  const meterSendInFlightRef = useRef<boolean>(false);

  const [meterDistanceMeters, setMeterDistanceMeters] = useState<number>(0);
  const [meterError, setMeterError] = useState<string | null>(null);
  const [meterPaused, setMeterPaused] = useState(false);

  const operatorPhone = useMemo(() => {
    const fromEnv = process.env.EXPO_PUBLIC_OPERATOR_PHONE;
    return (fromEnv && fromEnv.trim()) || "04245687814";
  }, []);

  const operatorLink = useMemo(() => {
    return buildWhatsappLink({
      phone: operatorPhone,
      text: "Hola, necesito ayuda de ZOE.",
    });
  }, [operatorPhone]);

  async function openOperator() {
    await Linking.openURL(operatorLink);
  }

  const passengerWhatsappLink = useMemo(() => {
    if (role !== "DRIVER") return null;
    const phone = attentionRide?.passenger?.phone;
    if (!phone || !attentionRide?.id) return null;
    return buildWhatsappLink({
      phone,
      text: `Hola, soy tu ejecutivo. Te escribo por el servicio (${String(attentionRide.id).slice(-6)}).`,
    });
  }, [role, attentionRide?.id, attentionRide?.passenger?.phone]);

  const driverWhatsappLink = useMemo(() => {
    if (role !== "USER") return null;
    const phone = attentionRide?.matchedDriver?.phone;
    if (!phone || !attentionRide?.id) return null;
    return buildWhatsappLink({
      phone,
      text: `Hola, soy tu cliente. Te escribo por el servicio (${String(attentionRide.id).slice(-6)}).`,
    });
  }, [role, attentionRide?.id, attentionRide?.matchedDriver?.phone]);

  async function openPassengerWhatsapp() {
    if (!passengerWhatsappLink) return;
    await Linking.openURL(passengerWhatsappLink);
  }

  async function openDriverWhatsapp() {
    if (!driverWhatsappLink) return;
    await Linking.openURL(driverWhatsappLink);
  }

  async function refreshRide(opts?: { showLoading?: boolean }) {
    if (!token) return;

    const showLoading = opts?.showLoading ?? true;

    setRideError(null);
    if (showLoading) setRideLoading(true);
    try {
      const res = await apiGetActiveRide(token);
      setAttentionRide(res.ride);
    } catch (e) {
      setRideError(e instanceof Error ? e.message : "No se pudo cargar el estado del viaje");
    } finally {
      if (showLoading) setRideLoading(false);
    }
  }

  async function ensureDriverCoords() {
    const ok = await ensureForegroundPermission();
    if (!ok) throw new Error("Necesitás habilitar la ubicación para ver servicios solicitados");

    const last = await getLastKnownCoords();
    if (last) return last;
    return getCurrentCoords();
  }

  async function refreshNearbyRequests(opts?: { showLoading?: boolean }) {
    if (!token) return;
    if (role !== "DRIVER") return;

    const showLoading = opts?.showLoading ?? true;
    setNearbyRequestsError(null);
    if (showLoading) setNearbyRequestsLoading(true);

    setNearbyOffersError(null);
    if (showLoading) setNearbyOffersLoading(true);

    try {
      const coords = await ensureDriverCoords();
      setDriverCoords(coords);
      await apiDriverUpsertLocation(token, coords);

      const [reqRes, offersRes] = await Promise.all([
        apiDriverNearbyRideRequests(token, { radiusM: 2000, take: 10 }),
        apiNearbyOffers(token, { lat: coords.lat, lng: coords.lng, radiusM: 2000 }),
      ]);

      setNearbyRequests(reqRes.items ?? []);
      setNearbyOffers((offersRes.items ?? []) as NearbyOfferItem[]);
    } catch (e) {
      setNearbyRequestsError(e instanceof Error ? e.message : "No se pudo cargar servicios solicitados");
      setNearbyOffersError(e instanceof Error ? e.message : "No se pudo cargar contraofertas cercanas");
    } finally {
      if (showLoading) setNearbyRequestsLoading(false);
      if (showLoading) setNearbyOffersLoading(false);
    }
  }

  async function offerServiceToRide(rideId: string) {
    if (!token) return;
    if (role !== "DRIVER") return;

    setOfferRideLoadingId(rideId);
    setNearbyRequestsError(null);
    try {
      await apiDriverOfferRide(token, { rideId });
      await refreshNearbyRequests({ showLoading: false });
    } catch (e) {
      setNearbyRequestsError(e instanceof Error ? e.message : "No se pudo ofrecer el servicio");
    } finally {
      setOfferRideLoadingId(null);
    }
  }

  useEffect(() => {
    if (!token) return;
    if (!isFocused) return;

    void refreshRide({ showLoading: true });
    if (role === "USER") {
      void (async () => {
        setOffersLoading(true);
        try {
          const res = await apiMyOffers(token);
          setMyOffers(res.offers);
        } catch {
          // silencioso
        } finally {
          setOffersLoading(false);
        }
      })();
    }
    const t = setInterval(() => {
      void refreshRide({ showLoading: false });
      if (role === "USER") {
        void (async () => {
          try {
            const res = await apiMyOffers(token);
            setMyOffers(res.offers);
          } catch {
            // ignore
          }
        })();
      }
    }, 8000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isFocused, role]);

  useEffect(() => {
    if (!token) return;
    if (!isFocused) return;
    if (role !== "USER") return;

    let alive = true;

    async function loadStored() {
      const stored = await getActiveRideOffersRideId();
      if (!alive) return;
      setOffersRideId(stored ?? null);
    }

    void loadStored();
    return () => {
      alive = false;
    };
  }, [token, isFocused, role]);

  useEffect(() => {
    if (!token) return;
    if (!isFocused) return;
    if (role !== "USER") return;
    if (!offersRideId) return;

    let alive = true;

    const tokenStr = token;
    const rideId = offersRideId;

    async function refreshOffersMeta(currentToken: string, currentRideId: string) {
      const showSpinner = offersRideFirstLoadRef.current;
      if (showSpinner) setOffersRideLoading(true);
      try {
        const rideRes = await apiGetRideById(currentToken, { rideId: currentRideId });
        if (!alive) return;
        const status = rideRes.ride?.status as string | undefined;
        const matched = Boolean(rideRes.ride?.matchedDriverId);

        if (!status || status !== "OPEN" || matched) {
          await clearActiveRideOffersRideId();
          if (!alive) return;
          setOffersRideId(null);
          setOffersRideCount(0);
          return;
        }

        const offersRes = await apiGetRideOffers(currentToken, { rideId: currentRideId });
        if (!alive) return;
        setOffersRideCount(Array.isArray(offersRes.items) ? offersRes.items.length : 0);
      } catch {
        // Si falla (por ejemplo ride borrado), limpiamos el puntero para no quedar clavados.
        await clearActiveRideOffersRideId();
        if (!alive) return;
        setOffersRideId(null);
        setOffersRideCount(0);
      } finally {
        if (!alive) return;
        if (showSpinner) setOffersRideLoading(false);
        offersRideFirstLoadRef.current = false;
      }
    }

    void refreshOffersMeta(tokenStr, rideId);
    const t = setInterval(() => {
      void refreshOffersMeta(tokenStr, rideId);
    }, 5000);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [token, isFocused, role, offersRideId]);

  useEffect(() => {
    if (!offersRideId) return;
    offersRideFirstLoadRef.current = true;
  }, [offersRideId]);

  useEffect(() => {
    if (!token) return;
    if (!isFocused) return;
    if (role !== "DRIVER") return;

    void refreshNearbyRequests({ showLoading: true });

    const t = setInterval(() => {
      void refreshNearbyRequests({ showLoading: false });
    }, 5000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isFocused, role]);

  useEffect(() => {
    const rideId = attentionRide?.id as string | undefined;
    const rideStatus = attentionRide?.status as string | undefined;

    const isOfferRide = Boolean(attentionRide?.offer);

    // El taxímetro debe seguir contando aunque el chofer navegue a otra pantalla
    // (mientras esta pantalla siga montada y la ride esté en progreso).
    const shouldRun = Boolean(token && role === "DRIVER" && rideId && rideStatus === "IN_PROGRESS" && !isOfferRide && !meterPaused);

    const stop = () => {
      if (meterWatchRef.current) {
        meterWatchRef.current.remove();
        meterWatchRef.current = null;
      }
      meterLastCoordsRef.current = null;
      meterSendInFlightRef.current = false;
      meterLastSentAtRef.current = 0;
      meterLastSentDistanceRef.current = 0;
    };

    const haversineMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const R = 6371000;
      const dLat = ((b.lat - a.lat) * Math.PI) / 180;
      const dLng = ((b.lng - a.lng) * Math.PI) / 180;
      const lat1 = (a.lat * Math.PI) / 180;
      const lat2 = (b.lat * Math.PI) / 180;
      const s1 = Math.sin(dLat / 2);
      const s2 = Math.sin(dLng / 2);
      const h = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2;
      return 2 * R * Math.asin(Math.sqrt(h));
    };

    const maybeSendMeter = async (distanceMetersRounded: number) => {
      if (!token || !rideId) return;
      if (meterSendInFlightRef.current) return;

      const now = Date.now();
      const minMsBetweenSends = 10_000;
      const minMetersBetweenSends = 25;

      const since = now - meterLastSentAtRef.current;
      const delta = distanceMetersRounded - meterLastSentDistanceRef.current;

      if (meterLastSentAtRef.current && (since < minMsBetweenSends || delta < minMetersBetweenSends)) return;

      meterSendInFlightRef.current = true;
      try {
        const res = await apiDriverUpdateMeter(token, rideId, { meterDistanceMeters: distanceMetersRounded });
        setAttentionRide((prev: any | null) => {
          if (!prev || prev.id !== rideId) return prev;
          return {
            ...prev,
            meterDistanceMeters: res.ride?.meterDistanceMeters,
            meterPrice: res.ride?.meterPrice,
          };
        });
        meterLastSentAtRef.current = now;
        meterLastSentDistanceRef.current = distanceMetersRounded;
        setMeterError(null);
      } catch (e) {
        setMeterError(e instanceof Error ? e.message : "No se pudo actualizar el taxímetro");
      } finally {
        meterSendInFlightRef.current = false;
      }
    };

    if (!shouldRun) {
      stop();
      return;
    }

    const backendMeters = Number(attentionRide?.meterDistanceMeters ?? 0);
    if (meterRideIdRef.current !== rideId) {
      // Nuevo servicio: inicializamos desde backend.
      meterRideIdRef.current = rideId || null;
      meterDistanceRef.current = Number.isFinite(backendMeters) && backendMeters > 0 ? backendMeters : 0;
    } else {
      // Reanudar (o re-render): nunca bajar el contador por falta de sincronización.
      const current = Number(meterDistanceRef.current ?? 0);
      const safeBackend = Number.isFinite(backendMeters) ? backendMeters : 0;
      meterDistanceRef.current = Math.max(current, safeBackend);
    }

    setMeterDistanceMeters(Math.round(meterDistanceRef.current));
    setMeterError(null);

    let cancelled = false;

    void (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        if (!perm.granted) {
          const req = await Location.requestForegroundPermissionsAsync();
          if (cancelled) return;
          if (!req.granted) {
            setMeterError("Necesitás habilitar GPS para el taxímetro");
            return;
          }
        }

        // Primer envío para que el precio base quede calculado desde el inicio
        await maybeSendMeter(Math.round(meterDistanceRef.current));

        const sub = await Location.watchPositionAsync(
          {
            // Más frecuente para reducir subestimación (línea recta) y mantener estabilidad.
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 2000,
            distanceInterval: 1,
          },
          (pos) => {
            if (cancelled) return;
            const coords = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              ts: typeof pos.timestamp === "number" ? pos.timestamp : Date.now(),
              accuracy: typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : null,
            };

            // Filtrar lecturas muy imprecisas (suele generar saltos grandes).
            if (coords.accuracy != null && coords.accuracy > 50) {
              return;
            }

            const prev = meterLastCoordsRef.current;
            if (!prev) {
              meterLastCoordsRef.current = coords;
              return;
            }

            const dtSec = Math.max(0, (coords.ts - prev.ts) / 1000);
            if (dtSec <= 0.2) return;

            const delta = haversineMeters(prev, coords);

            // Filtrado básico de saltos raros
            if (!Number.isFinite(delta) || delta <= 0.5) {
              // Delta insignificante: actualizamos ancla para no acumular deriva.
              meterLastCoordsRef.current = coords;
              return;
            }

            // Salto gigante: no cambiamos el punto previo (evita perder distancia por rebotes)
            if (delta > 1000) return;

            // Filtrado por velocidad (m/s). Evita sumar metros por rebotes de GPS.
            const deviceSpeed =
              typeof pos.coords.speed === "number" && Number.isFinite(pos.coords.speed) && pos.coords.speed >= 0 ? pos.coords.speed : null;
            const speed = deviceSpeed ?? delta / dtSec;
            if (!Number.isFinite(speed) || speed > 55) return;

            // Umbral mínimo según precisión: ignora movimiento dentro del margen de error.
            const prevAcc = typeof prev.accuracy === "number" && Number.isFinite(prev.accuracy) ? prev.accuracy : 15;
            const curAcc = typeof coords.accuracy === "number" && Number.isFinite(coords.accuracy) ? coords.accuracy : 15;
            const movementThreshold = Math.max(2, Math.min(15, (prevAcc + curAcc) / 2));

            if (delta < movementThreshold) {
              // Ruido/deriva típica: movemos el ancla pero no sumamos metros.
              meterLastCoordsRef.current = coords;
              return;
            }

            // Aceptado: actualizar ancla y sumar.
            meterLastCoordsRef.current = coords;

            meterDistanceRef.current += delta;
            const rounded = Math.round(meterDistanceRef.current);
            setMeterDistanceMeters(rounded);
            void maybeSendMeter(rounded);
          }
        );

        meterWatchRef.current = sub;
      } catch (e) {
        if (cancelled) return;
        setMeterError(e instanceof Error ? e.message : "No se pudo iniciar el taxímetro");
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isFocused, role, attentionRide?.id, attentionRide?.status, attentionRide?.offer?.id, meterPaused]);

  useEffect(() => {
    // Si cambia la carrera, reseteamos el pause.
    setMeterPaused(false);
  }, [attentionRide?.id]);

  function toggleMeterPaused() {
    setMeterPaused((p) => !p);
  }

  async function resetMeterNow() {
    if (!token) return;
    if (role !== "DRIVER") return;
    if (!attentionRide) return;
    if (attentionRide.status !== "IN_PROGRESS") return;
    if (attentionRide.offer) return;

    meterDistanceRef.current = 0;
    meterLastCoordsRef.current = null;
    meterLastSentAtRef.current = 0;
    meterLastSentDistanceRef.current = 0;
    setMeterDistanceMeters(0);
    setMeterError(null);

    try {
      const res = await apiDriverUpdateMeter(token, attentionRide.id, { meterDistanceMeters: 0 });
      setAttentionRide((prev: any | null) => {
        if (!prev || prev.id !== attentionRide.id) return prev;
        return {
          ...prev,
          meterDistanceMeters: res.ride?.meterDistanceMeters,
          meterPrice: res.ride?.meterPrice,
        };
      });
    } catch (e) {
      setMeterError(e instanceof Error ? e.message : "No se pudo reiniciar el taxímetro");
    }
  }

  function confirmResetMeter() {
    Alert.alert(
      "Reiniciar taxímetro",
      "Si confirmás, se perderá el recorrido acumulado de esta carrera.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Reiniciar",
          style: "destructive",
          onPress: () => {
            void resetMeterNow();
          },
        },
      ]
    );
  }

  useEffect(() => {
    if (!token || !isFocused) return;
    if (role !== "DRIVER") return;
    if (!attentionRide || attentionRide.status !== "IN_PROGRESS") return;

    const backendMeters = Math.round(Number(attentionRide.meterDistanceMeters ?? 0));
    if (backendMeters > Math.round(meterDistanceRef.current) + 5) {
      meterDistanceRef.current = backendMeters;
      setMeterDistanceMeters(backendMeters);
      // Evita un envío inmediato redundante si el backend ya está más adelante
      meterLastSentDistanceRef.current = backendMeters;
    }
  }, [token, isFocused, role, attentionRide?.status, attentionRide?.meterDistanceMeters]);

  const openOffer = useMemo(() => {
    return Array.isArray(myOffers) && myOffers.length ? myOffers[0] : null;
  }, [myOffers]);

  const userHasActiveRide = useMemo(() => {
    if (role !== "USER") return false;
    const status = attentionRide?.status as string | undefined;
    return status === "OPEN" || status === "ASSIGNED" || status === "ACCEPTED" || status === "MATCHED" || status === "IN_PROGRESS";
  }, [role, attentionRide?.status]);

  const userHasOpenOffer = useMemo(() => {
    if (role !== "USER") return false;
    return Boolean(openOffer);
  }, [role, openOffer]);

  async function cancelMyOffer() {
    if (!token || !openOffer) return;
    setRideActionLoading(true);
    setRideError(null);
    try {
      await apiCancelOffer(token, openOffer.id);
      const res = await apiMyOffers(token);
      setMyOffers(res.offers);
    } catch (e) {
      setRideError(e instanceof Error ? e.message : "No se pudo cancelar la contraoferta");
    } finally {
      setRideActionLoading(false);
    }
  }

  async function cancelMyRideNow() {
    if (!token || !attentionRide) return;

    setRideActionLoading(true);
    setRideError(null);
    try {
      await apiCancelRide(token, { rideId: attentionRide.id });
      await clearActiveRideOffersRideId();
      setOffersRideId(null);
      setOffersRideCount(0);
      await refreshRide({ showLoading: false });
    } catch (e) {
      setRideError(e instanceof Error ? e.message : "No se pudo cancelar el servicio");
    } finally {
      setRideActionLoading(false);
    }
  }

  function confirmCancelMyRide() {
    Alert.alert("Cancelar servicio", "Vas a cancelar tu solicitud actual. ¿Querés continuar?", [
      { text: "Volver", style: "cancel" },
      {
        text: "Cancelar servicio",
        style: "destructive",
        onPress: () => {
          void cancelMyRideNow();
        },
      },
    ]);
  }

  const ratingDirection = role === "USER" ? "PASSENGER_TO_DRIVER" : role === "DRIVER" ? "DRIVER_TO_PASSENGER" : null;
  const canRate = useMemo(() => {
    if (!attentionRide || !ratingDirection) return false;
    if (attentionRide.status !== "COMPLETED") return false;
    const ratings: any[] = Array.isArray(attentionRide.ratings) ? attentionRide.ratings : [];
    return !ratings.some((r) => r?.direction === ratingDirection);
  }, [attentionRide, ratingDirection]);

  const displayName = useMemo(() => userDisplayName(auth.user), [auth.user]);
  const displayRole = useMemo(() => roleLabel(role), [role]);

  const meterPriceToShow = useMemo(() => {
    if (!attentionRide || role !== "DRIVER" || attentionRide.status !== "IN_PROGRESS") return null;
    if (attentionRide.offer) return null;

    const baseFare = Number(attentionRide.pricingBaseFare ?? 0);
    const perKm = Number(attentionRide.pricingPerKm ?? 0);
    const ac = Number(attentionRide.pricingAcSurcharge ?? 0);
    const trunk = Number(attentionRide.pricingTrunkSurcharge ?? 0);
    const pets = Number(attentionRide.pricingPetsSurcharge ?? 0);
    const surcharge = (attentionRide.wantsAC ? ac : 0) + (attentionRide.wantsTrunk ? trunk : 0) + (attentionRide.wantsPets ? pets : 0);

    const includedMeters = Math.max(0, Math.floor(Number(attentionRide.pricingIncludedMeters ?? 0)));
    const stepMeters = Math.max(0, Math.floor(Number(attentionRide.pricingStepMeters ?? 0)));
    const stepPrice = Number(attentionRide.pricingStepPrice ?? 0);

    const useSteps = stepMeters > 0 && Number.isFinite(stepPrice) && stepPrice > 0;
    let distanceCharge = 0;
    if (useSteps) {
      const extraMeters = Math.max(0, Math.floor(Math.max(0, meterDistanceMeters) - includedMeters));
      const steps = extraMeters > 0 ? Math.ceil(extraMeters / stepMeters) : 0;
      distanceCharge = steps * stepPrice;
    } else {
      const kmWhole = Math.floor(Math.max(0, meterDistanceMeters) / 1000);
      const extraKm = Math.max(0, kmWhole - meterIncludedKm);
      distanceCharge = perKm * extraKm;
    }

    const computed = baseFare + distanceCharge + surcharge;
    const computedRounded = Math.max(0, Math.round(computed * 100) / 100);

    const backend = Number(attentionRide.meterPrice ?? 0);
    return backend > 0 ? backend : computedRounded;
  }, [attentionRide, meterDistanceMeters, meterIncludedKm, role]);

  const meterSecondary = useMemo(() => {
    if (meterPriceToShow == null) return null;
    return formatSecondaryFromCop(Number(meterPriceToShow), auth.appConfig ?? {});
  }, [meterPriceToShow, auth.appConfig]);

  async function driverAction(action: "accept" | "start" | "complete") {
    if (!token || !attentionRide) return;
    setRideActionLoading(true);
    setRideError(null);
    try {
      if (action === "accept") await apiDriverAcceptRide(token, attentionRide.id);
      if (action === "start") await apiDriverStartRide(token, attentionRide.id);
      if (action === "complete") await apiDriverCompleteRide(token, attentionRide.id);
      await refreshRide();
    } catch (e) {
      setRideError(e instanceof Error ? e.message : "No se pudo actualizar tu servicio");
    } finally {
      setRideActionLoading(false);
    }
  }

  async function notifyPassengerArrived() {
    if (!token || !attentionRide) return;
    if (role !== "DRIVER") return;

    setNotifyLoading(true);
    setRideError(null);
    try {
      await apiDriverNotifyArrived(token, attentionRide.id);
    } catch (e) {
      setRideError(e instanceof Error ? e.message : "No se pudo notificar al cliente");
    } finally {
      setNotifyLoading(false);
    }
  }

  async function submitRating(stars: number) {
    if (!token || !attentionRide) return;
    setRideActionLoading(true);
    setRideError(null);
    try {
      await apiCreateRating(token, { rideId: attentionRide.id, stars });
      await refreshRide();
    } catch (e) {
      setRideError(e instanceof Error ? e.message : "No se pudo enviar la calificación");
    } finally {
      setRideActionLoading(false);
    }
  }

  const scrollPadBottom = 120;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: scrollPadBottom }} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Ionicons name="sparkles" size={20} color={colors.gold} />
            <GoldTitle>Inicio</GoldTitle>
          </View>

          <Pressable style={styles.operatorBtn} onPress={() => void openOperator()}>
            <Image source={zoeImg} style={styles.operatorImg} resizeMode="contain" />
            <Text style={styles.operatorText}>ZOE</Text>
          </Pressable>
        </View>

        <Card style={styles.card}>
          <View style={styles.welcomeRow}>
            <Ionicons name="sparkles" size={18} color={colors.gold} />
            <Text style={styles.title}>Bienvenido {displayName}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name={role === "ADMIN" ? "shield-checkmark-outline" : role === "DRIVER" ? "car-outline" : "person-outline"} size={16} color={colors.mutedText} />
            <Text style={styles.line}>Rol: {displayRole}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={16} color={colors.mutedText} />
            <Text style={styles.line}>Usuario: {auth.user?.email ?? auth.user?.username ?? "-"}</Text>
          </View>
        </Card>

        {role === "USER" ? (
          <Card style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="person-outline" size={18} color={colors.gold} />
              <Text style={styles.sectionTitle}>Servicios Cliente</Text>
            </View>
            <Text style={styles.sectionText}>Acá vas a solicitar traslados, hacer ofertas y ver tu historial.</Text>

            <View style={{ marginTop: 10, gap: 10 }}>
              <PrimaryButton
                label="Solicitar traslado"
                onPress={() => navigation.navigate("PassengerDriversMap")}
                disabled={userHasActiveRide || userHasOpenOffer}
              />
              <SecondaryButton
                label={
                  offersRideId
                    ? offersRideLoading
                      ? `Ejecutivos ofrecidos (${offersRideCount})...`
                      : `Ejecutivos ofrecidos (${offersRideCount})`
                    : "Ejecutivos ofrecidos"
                }
                onPress={() => {
                  if (!offersRideId) return;
                  navigation.navigate("PassengerOffersWait", { rideId: offersRideId });
                }}
                disabled={!offersRideId || offersRideLoading}
              />
              <SecondaryButton
                label="Hacer oferta"
                onPress={() => navigation.navigate("PassengerMakeOffer")}
                disabled={userHasActiveRide || userHasOpenOffer}
              />
              <View style={{ height: 6 }} />
              <SecondaryButton label="Historial" onPress={() => navigation.navigate("RidesHistory")} />
            </View>
          </Card>
        ) : null}

      {token ? (
        <Card style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="time-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Tu servicio</Text>
          </View>

          {rideLoading ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
              <ActivityIndicator color={colors.gold} />
              <Text style={styles.sectionText}>Actualizando...</Text>
            </View>
          ) : null}

          {!!rideError ? <Text style={[styles.sectionText, { color: colors.danger }]}>{rideError}</Text> : null}

          {attentionRide ? (
            <>
              <Text style={styles.sectionText}>
                Estado: {rideStatusLabel({ status: attentionRide.status, role, canRate })}
              </Text>

              {role === "DRIVER" && attentionRide.status === "ASSIGNED" ? (
                <View style={styles.noticeBox}>
                  <Ionicons name="notifications-outline" size={18} color={colors.gold} />
                  <Text style={styles.noticeText}>Tenés un servicio por aceptar</Text>
                </View>
              ) : null}

              {role === "USER" && (attentionRide.status === "ASSIGNED" || attentionRide.status === "ACCEPTED") ? (
                <View style={styles.noticeBox}>
                  <Ionicons name="notifications-outline" size={18} color={colors.gold} />
                  <Text style={styles.noticeText}>
                    {attentionRide.status === "ACCEPTED" ? "Tu ejecutivo aceptó tu servicio" : "Un ejecutivo fue asignado a tu servicio"}
                  </Text>
                </View>
              ) : null}

              <View style={{ marginTop: 8 }}>
                <SecondaryButton
                  label="Ver detalle"
                  onPress={() => navigation.navigate("RideDetails", { rideId: attentionRide.id })}
                />
              </View>

              {attentionRide.agreedPrice != null ? (
                <Text style={styles.sectionText}>Precio acordado: {formatCop(Number(attentionRide.agreedPrice))}</Text>
              ) : null}

              {role === "USER" && attentionRide.matchedDriver ? (
                <>
                  <Text style={styles.sectionText}>Ejecutivo: {attentionRide.matchedDriver.fullName}</Text>
                  {driverWhatsappLink && (attentionRide.status === "ASSIGNED" || attentionRide.status === "ACCEPTED" || attentionRide.status === "IN_PROGRESS") ? (
                    <Pressable onPress={() => void openDriverWhatsapp()} style={({ pressed }) => [styles.whatsBtn, pressed && styles.pressed]}>
                      <Ionicons name="logo-whatsapp" size={18} color={colors.gold} />
                      <Text style={styles.whatsText}>Hablar con Ejecutivo</Text>
                    </Pressable>
                  ) : null}
                  {attentionRide.matchedDriver.phone ? (
                    <Text style={styles.sectionText}>Tel: {attentionRide.matchedDriver.phone}</Text>
                  ) : null}
                  {attentionRide.matchedDriver.serviceType ? (
                    <Text style={styles.sectionText}>Tipo: {serviceTypeLabel(attentionRide.matchedDriver.serviceType)}</Text>
                  ) : null}
                  {attentionRide.matchedDriver.vehicle ? (
                    <Text style={styles.sectionText}>
                      Vehículo: {attentionRide.matchedDriver.vehicle.brand} {attentionRide.matchedDriver.vehicle.model}
                      {attentionRide.matchedDriver.vehicle.plate ? ` • ${attentionRide.matchedDriver.vehicle.plate}` : ""}
                    </Text>
                  ) : null}
                </>
              ) : null}

              {role === "USER" && (attentionRide.status === "OPEN" || attentionRide.status === "ASSIGNED" || attentionRide.status === "ACCEPTED" || attentionRide.status === "MATCHED") ? (
                <View style={{ marginTop: 10 }}>
                  <SecondaryButton
                    label={rideActionLoading ? "Cancelando..." : "Cancelar servicio"}
                    onPress={confirmCancelMyRide}
                    disabled={rideActionLoading}
                  />
                </View>
              ) : null}
              {role === "DRIVER" && attentionRide.passenger ? (
                <>
                  <Text style={styles.sectionText}>Pasajero: {attentionRide.passenger.fullName}</Text>
                  {attentionRide.passenger.phone ? <Text style={styles.sectionText}>Tel: {attentionRide.passenger.phone}</Text> : null}
                </>
              ) : null}

              {role === "DRIVER" ? (
                <View style={{ marginTop: 10, gap: 10 }}>
                  {passengerWhatsappLink && (attentionRide.status === "ACCEPTED" || attentionRide.status === "IN_PROGRESS") ? (
                    <Pressable
                      onPress={() => void openPassengerWhatsapp()}
                      style={({ pressed }) => [styles.whatsBtn, pressed && styles.pressed]}
                    >
                      <Ionicons name="logo-whatsapp" size={18} color={colors.gold} />
                      <Text style={styles.whatsText}>Hablar con Cliente</Text>
                    </Pressable>
                  ) : null}

                  {attentionRide.status === "ASSIGNED" ? (
                    <PrimaryButton
                      label={rideActionLoading ? "Procesando..." : "Aceptar carrera"}
                      onPress={() => void driverAction("accept")}
                      disabled={rideActionLoading}
                    />
                  ) : null}

                  {attentionRide.status === "ACCEPTED" ? (
                    <>
                      {attentionRide.offer ? (
                        <View style={styles.meterBox}>
                          <View style={styles.meterTitleRow}>
                            <Ionicons name="map-outline" size={16} color={colors.gold} />
                            <Text style={styles.meterTitle}>Ruta</Text>
                          </View>

                          <MiniRouteMap
                            pickup={{ lat: Number(attentionRide.pickupLat), lng: Number(attentionRide.pickupLng) }}
                            dropoff={{ lat: Number(attentionRide.dropoffLat), lng: Number(attentionRide.dropoffLng) }}
                            routePath={(attentionRide.routePath ?? attentionRide.offer?.routePath ?? null) as any}
                            height={140}
                          />

                          {attentionRide.agreedPrice != null ? (
                            <Text style={styles.meterBigLine}>Monto acordado: {formatCop(Number(attentionRide.agreedPrice))}</Text>
                          ) : null}
                        </View>
                      ) : null}

                      <PrimaryButton
                        label={rideActionLoading ? "Procesando..." : "Iniciar carrera"}
                        onPress={() => void driverAction("start")}
                        disabled={rideActionLoading}
                      />

                      <SecondaryButton
                        label={notifyLoading ? "Notificando..." : "Notificar al cliente"}
                        onPress={() => void notifyPassengerArrived()}
                        disabled={notifyLoading}
                      />
                    </>
                  ) : null}

                  {attentionRide.status === "IN_PROGRESS" ? (
                    <>
                      {attentionRide.offer ? (
                        <View style={styles.meterBox}>
                          <View style={styles.meterTitleRow}>
                            <Ionicons name="map-outline" size={16} color={colors.gold} />
                            <Text style={styles.meterTitle}>Ruta</Text>
                          </View>

                          <MiniRouteMap
                            pickup={{ lat: Number(attentionRide.pickupLat), lng: Number(attentionRide.pickupLng) }}
                            dropoff={{ lat: Number(attentionRide.dropoffLat), lng: Number(attentionRide.dropoffLng) }}
                            routePath={(attentionRide.routePath ?? attentionRide.offer?.routePath ?? null) as any}
                            height={140}
                          />

                          {attentionRide.agreedPrice != null ? (
                            <Text style={styles.meterBigLine}>Monto acordado: {formatCop(Number(attentionRide.agreedPrice))}</Text>
                          ) : null}
                        </View>
                      ) : (
                        <View style={styles.meterBox}>
                          <View style={styles.meterTopRow}>
                            <View style={{ flex: 1, gap: 8 }}>
                              <View style={styles.meterTitleRow}>
                                <Ionicons name="speedometer-outline" size={16} color={colors.gold} />
                                <Text style={styles.meterTitle}>Taxímetro</Text>
                              </View>

                              <Text style={styles.meterBigLine}>{Math.round(meterDistanceMeters)} m</Text>
                              {meterPriceToShow != null ? (
                                <>
                                  <Text style={styles.meterBigLine}>{formatCop(Number(meterPriceToShow))}</Text>
                                  {meterSecondary ? <Text style={styles.meterSmallLine}>{meterSecondary}</Text> : null}
                                </>
                              ) : null}
                            </View>

                            <View style={styles.meterActionsCol}>
                              <Pressable
                                onPress={toggleMeterPaused}
                                style={({ pressed }) => [styles.meterActionBtn, pressed && styles.pressed]}
                              >
                                <Ionicons
                                  name={meterPaused ? "play-outline" : "pause-outline"}
                                  size={18}
                                  color={colors.gold}
                                />
                                <Text style={styles.meterActionText}>{meterPaused ? "Reanudar" : "Pausar"}</Text>
                              </Pressable>

                              <Pressable
                                onPress={confirmResetMeter}
                                style={({ pressed }) => [styles.meterActionBtn, pressed && styles.pressed]}
                              >
                                <Ionicons name="refresh-outline" size={18} color={colors.gold} />
                                <Text style={styles.meterActionText}>Reiniciar</Text>
                              </Pressable>
                            </View>
                          </View>

                          {!!meterError ? <Text style={[styles.sectionText, { color: colors.danger }]}>{meterError}</Text> : null}
                        </View>
                      )}

                      <PrimaryButton
                        label={rideActionLoading ? "Procesando..." : "Finalizar carrera"}
                        onPress={() => void driverAction("complete")}
                        disabled={rideActionLoading}
                      />
                    </>
                  ) : null}
                </View>
              ) : null}

              {canRate ? (
                <View style={{ marginTop: 10, gap: 8 }}>
                  <Text style={[styles.sectionText, { color: colors.text, fontWeight: "900" }]}>Calificar</Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Pressable
                        key={n}
                        style={styles.starBtn}
                        onPress={() => void submitRating(n)}
                        disabled={rideActionLoading}
                      >
                        <Ionicons name="star" size={18} color={colors.gold} />
                        <Text style={styles.starText}>{n}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.sectionText}>No tenés un servicio activo.</Text>
          )}
        </Card>
      ) : null}

      {role === "DRIVER" ? (
        <Card style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="list-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Servicios solicitados</Text>
          </View>

          <Text style={styles.sectionText}>Acá vas a ver solicitudes cercanas y ofrecer tu servicio.</Text>

          {nearbyRequestsLoading ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
              <ActivityIndicator color={colors.gold} />
              <Text style={styles.sectionText}>Actualizando...</Text>
            </View>
          ) : null}

          {!!nearbyRequestsError ? <Text style={[styles.sectionText, { color: colors.danger }]}>{nearbyRequestsError}</Text> : null}

          <View style={{ marginTop: 10, gap: 10 }}>
            {nearbyRequests.slice(0, 10).map((r: any) => {
              const status = r?.myOffer?.status as string | undefined;
              const busy = offerRideLoadingId === r.rideId;

              const label =
                status === "OFFERED"
                  ? "Ofrecido"
                  : status === "REJECTED"
                    ? "Rechazado"
                    : status === "SELECTED"
                      ? "Seleccionado"
                      : busy
                        ? "Ofreciendo..."
                        : "Ofrecer servicio";

              const disabled = busy || status === "OFFERED" || status === "REJECTED" || status === "SELECTED";

                const firstName = (r?.passenger?.firstName as string | undefined) ?? "";
                const lastName = (r?.passenger?.lastName as string | undefined) ?? "";
                const fullName = (r?.passenger?.fullName as string | undefined) ?? "";
                const passengerName = `${firstName} ${lastName}`.trim() || fullName || "-";
              const distMeters = Math.round(Number(r?.distanceMeters ?? 0));
              const pickupLat = Number(r?.pickup?.lat);
              const pickupLng = Number(r?.pickup?.lng);
              const dropoffLat = Number(r?.dropoff?.lat);
              const dropoffLng = Number(r?.dropoff?.lng);

              const pickupText = (r?.pickup?.address as string | undefined) ?? null;
              const dropoffText = (r?.dropoff?.address as string | undefined) ?? null;

              function splitAddress(addr: string | null) {
                if (!addr) return { main: null as string | null, zone: null as string | null };
                const parts = addr
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
                if (parts.length <= 1) return { main: addr, zone: null };
                return {
                  main: parts.slice(0, -1).join(", ") || addr,
                  zone: parts[parts.length - 1] || null,
                };
              }

              const pickupSplit = splitAddress(pickupText);
              const dropoffSplit = splitAddress(dropoffText);

              const canRouteMap =
                Number.isFinite(pickupLat) &&
                Number.isFinite(pickupLng) &&
                Number.isFinite(dropoffLat) &&
                Number.isFinite(dropoffLng) &&
                (Math.abs(pickupLat - dropoffLat) > 0.00001 || Math.abs(pickupLng - dropoffLng) > 0.00001);
              const canMap = Boolean(
                driverCoords &&
                  Number.isFinite(driverCoords.lat) &&
                  Number.isFinite(driverCoords.lng) &&
                  Number.isFinite(pickupLat) &&
                  Number.isFinite(pickupLng)
              );

              // Importante: no mostramos estimados acá (solo datos base del cliente).

              return (
                <Card key={r.rideId} style={{ gap: 10 }}>
                  {canRouteMap ? (
                    <MiniRouteMap
                      height={130}
                      pickup={{ lat: pickupLat, lng: pickupLng }}
                      dropoff={{ lat: dropoffLat, lng: dropoffLng }}
                    />
                  ) : canMap ? (
                    <MiniMeetMap
                      height={120}
                      driver={{ lat: driverCoords!.lat, lng: driverCoords!.lng }}
                      passenger={{ lat: pickupLat, lng: pickupLng }}
                      driverIconName="car"
                      passengerIconName="person"
                    />
                  ) : null}

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={styles.requestAvatar}>
                      <Ionicons name="person" size={16} color={colors.gold} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.requestTitle}>{passengerName}</Text>
                      <View style={styles.requestMetaRow}>
                        <Ionicons name="walk-outline" size={14} color={colors.mutedText} />
                        <Text style={styles.requestMetaText}>{distMeters} m</Text>
                      </View>
                    </View>
                    <View style={styles.requestPill}>
                      <Ionicons
                        name={status === "OFFERED" ? "checkmark-circle-outline" : "flash-outline"}
                        size={14}
                        color={colors.gold}
                      />
                      <Text style={styles.requestPillText}>{status === "OFFERED" ? "Ofrecido" : "Cerca"}</Text>
                    </View>
                  </View>

                  {pickupText ? (
                    <>
                      <View style={styles.requestMetaRow}>
                        <Ionicons name="location-outline" size={14} color={colors.mutedText} />
                        <Text style={styles.requestMetaText}>Salida: {pickupSplit.main ?? pickupText}</Text>
                      </View>
                      {pickupSplit.zone ? (
                        <View style={styles.requestMetaRow}>
                          <Ionicons name="map-outline" size={14} color={colors.mutedText} />
                          <Text style={styles.requestMetaText}>Zona salida: {pickupSplit.zone}</Text>
                        </View>
                      ) : null}
                    </>
                  ) : null}

                  {dropoffText ? (
                    <>
                      <View style={styles.requestMetaRow}>
                        <Ionicons name="flag-outline" size={14} color={colors.mutedText} />
                        <Text style={styles.requestMetaText}>Destino: {dropoffSplit.main ?? dropoffText}</Text>
                      </View>
                      {dropoffSplit.zone ? (
                        <View style={styles.requestMetaRow}>
                          <Ionicons name="map-outline" size={14} color={colors.mutedText} />
                          <Text style={styles.requestMetaText}>Zona destino: {dropoffSplit.zone}</Text>
                        </View>
                      ) : null}
                    </>
                  ) : null}

                  <PrimaryButton label={label} onPress={() => void offerServiceToRide(r.rideId)} disabled={disabled} />
                </Card>
              );
            })}

            {!nearbyRequestsLoading && nearbyRequests.length === 0 ? (
              <Card>
                <Text style={styles.sectionText}>No hay solicitudes cercanas por ahora.</Text>
              </Card>
            ) : null}
          </View>
        </Card>
      ) : null}

      {role === "DRIVER" ? (
        <Card style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="pricetag-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Contraofertas cercanas</Text>
          </View>

          <Text style={styles.sectionText}>Se muestran dentro de 2 km (2000 m).</Text>

          {nearbyOffersLoading ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
              <ActivityIndicator color={colors.gold} />
              <Text style={styles.sectionText}>Actualizando...</Text>
            </View>
          ) : null}

          {!!nearbyOffersError ? <Text style={[styles.sectionText, { color: colors.danger }]}>{nearbyOffersError}</Text> : null}

          <View style={{ marginTop: 10, gap: 10 }}>
            {nearbyOffers.slice(0, 6).map((o) => (
              <Pressable key={o.offerId} onPress={() => navigation.navigate("DriverOfferDetails", { offerId: o.offerId })}>
                <Card style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                      <Ionicons name="location-outline" size={16} color={colors.gold} />
                      <Text style={[styles.sectionText, { color: colors.text, fontWeight: "900" }]}>
                        Oferta {serviceTypeLabel(o.serviceTypeWanted)}
                      </Text>
                    </View>
                    <View style={styles.requestPill}>
                      <Ionicons name="walk-outline" size={14} color={colors.gold} />
                      <Text style={styles.requestPillText}>{Math.round(o.distanceMeters)} m</Text>
                    </View>
                  </View>

                  <Text style={styles.sectionText}>
                    Ofrecido: {formatCop(Number(o.offeredPrice))} • Estimado: {formatCop(Number(o.estimatedPrice))}
                  </Text>
                </Card>
              </Pressable>
            ))}

            {!nearbyOffersLoading && nearbyOffers.length === 0 ? (
              <Card>
                <Text style={styles.sectionText}>No hay contraofertas cercanas por ahora.</Text>
              </Card>
            ) : null}
          </View>

          <View style={{ marginTop: 10 }}>
            <SecondaryButton label="Ver todas" onPress={() => navigation.navigate("DriverOffersList")} />
          </View>
        </Card>
      ) : null}

      {role === "USER" && openOffer ? (
        <Card style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="pricetag-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Tu contraoferta</Text>
          </View>

          {offersLoading ? <Text style={styles.sectionText}>Actualizando...</Text> : null}

          <>
            <Text style={styles.sectionText}>Servicio: {serviceTypeLabel(openOffer.serviceTypeWanted)}</Text>
            <Text style={styles.sectionText}>Ofrecido: {formatCop(Number(openOffer.offeredPrice))}</Text>
            <Text style={styles.sectionText}>Radio: {openOffer.searchRadiusM} m</Text>

            <View style={{ marginTop: 10 }}>
              <MiniRouteMap
                pickup={{ lat: Number(openOffer.pickupLat), lng: Number(openOffer.pickupLng) }}
                dropoff={{ lat: Number(openOffer.dropoffLat), lng: Number(openOffer.dropoffLng) }}
                routePath={(openOffer.routePath ?? null) as any}
              />
            </View>

            <View style={{ marginTop: 10 }}>
              <SecondaryButton
                label={rideActionLoading ? "Cancelando..." : "Cancelar contraoferta"}
                onPress={() => void cancelMyOffer()}
                disabled={rideActionLoading}
              />
            </View>
          </>
        </Card>
      ) : null}

      {role === "ADMIN" ? (
        <Card style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Administración</Text>
          </View>
          <Text style={styles.sectionText}>Desde acá vas a gestionar choferes, viajes y recuperaciones.</Text>

          <View style={{ marginTop: 10, gap: 10 }}>
            <PrimaryButton label="Configuración" onPress={() => navigation.navigate("AdminSettings")} />
            <PrimaryButton label="Choferes" onPress={() => navigation.navigate("AdminDrivers")} />
            <PrimaryButton label="Clientes" onPress={() => navigation.navigate("AdminPassengers")} />
            <SecondaryButton label="Viajes" onPress={() => navigation.navigate("AdminRides")} />
            <SecondaryButton label="Recuperaciones" onPress={() => navigation.navigate("AdminPasswordResets")} />
          </View>
        </Card>
      ) : null}

      {role === "DRIVER" ? (
        <Card style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="car-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Ejecutivo</Text>
          </View>
          <Text style={styles.sectionText}>Acá vas a ver viajes asignados y aceptarlos para comenzar.</Text>

          <View style={{ marginTop: 10 }}>
            <PrimaryButton label="Contraofertas cercanas" onPress={() => navigation.navigate("DriverOffersList")} />
            <View style={{ height: 10 }} />
            <SecondaryButton label="Mapa / Ubicación" onPress={() => navigation.navigate("DriverMap")} />
            <View style={{ height: 10 }} />
            <SecondaryButton label="Historial" onPress={() => navigation.navigate("RidesHistory")} />
            <View style={{ height: 10 }} />
            <SecondaryButton label="Créditos (COP)" onPress={() => navigation.navigate("Credits")} />
          </View>
        </Card>
      ) : null}

        <View style={{ height: 14 }} />
        <PrimaryButton label="Cerrar sesión" onPress={() => void auth.logout()} />

        <View style={styles.footerBrand}>
          <Image source={playstoreImg} style={styles.footerBrandImg} resizeMode="contain" />
        </View>
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
  operatorBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.card,
    shadowColor: colors.text,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
  footerBrand: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  footerBrandImg: {
    width: 320,
    height: 90,
  },
  operatorImg: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  operatorText: {
    marginTop: 2,
    color: colors.text,
    fontSize: 10,
    fontWeight: "900",
  },
  whatsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.card,
  },
  whatsText: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: "900",
  },
  card: { marginTop: 16, gap: 8 },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  welcomeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  line: {
    color: colors.mutedText,
    fontSize: 14,
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
  sectionText: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
  },

  requestAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  requestTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
  },
  requestMetaRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  requestMetaText: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  requestPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  requestPillText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.85,
  },
  starBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  starText: {
    color: colors.text,
    fontWeight: "900",
  },

  meterBox: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  meterTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  meterTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  meterActionsCol: {
    gap: 10,
    alignItems: "flex-end",
  },
  meterActionBtn: {
    minWidth: 92,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    gap: 6,
  },
  meterActionText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "700",
  },
  meterTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  meterLine: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
  },
  meterBigLine: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
  },
  meterSmallLine: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },

  noticeBox: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.card,
    borderRadius: 14,
  },
  noticeText: {
    flex: 1,
    color: colors.text,
    fontWeight: "900",
  },
});
