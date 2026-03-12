import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "xpress_auth_token";
const ACTIVE_RIDE_OFFERS_RIDE_ID_KEY = "xpress_active_ride_offers_ride_id";

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getActiveRideOffersRideId() {
  return SecureStore.getItemAsync(ACTIVE_RIDE_OFFERS_RIDE_ID_KEY);
}

export async function setActiveRideOffersRideId(rideId: string) {
  await SecureStore.setItemAsync(ACTIVE_RIDE_OFFERS_RIDE_ID_KEY, rideId);
}

export async function clearActiveRideOffersRideId() {
  await SecureStore.deleteItemAsync(ACTIVE_RIDE_OFFERS_RIDE_ID_KEY);
}
