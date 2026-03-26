export type Coords = { lat: number; lng: number };

const DEFAULT_ROUTE_TIMEOUT_MS = 3200;
const CACHE_TTL_MS = 60_000;
const FAILURE_CACHE_TTL_MS = 8_000;
const CACHE_MAX = 250;
const BUILTIN_OSRM_BASE_URLS = ["https://router.project-osrm.org", "https://routing.openstreetmap.de/routed-car"];

type CacheEntry<T> = { ts: number; value: T; ttlMs: number };

const routeCache = new Map<string, CacheEntry<{ distanceMeters: number; durationSeconds: number; path: { latitude: number; longitude: number }[] } | null>>();
const distCache = new Map<string, CacheEntry<number | null>>();
const nearestCache = new Map<string, CacheEntry<Coords | null>>();

function cacheGet<T>(map: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = map.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > entry.ttlMs) {
    map.delete(key);
    return undefined;
  }
  return entry.value;
}

function cacheSet<T>(map: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs = CACHE_TTL_MS) {
  if (map.size >= CACHE_MAX) {
    // simple: borra el primero insertado
    const firstKey = map.keys().next().value as string | undefined;
    if (firstKey) map.delete(firstKey);
  }
  map.set(key, { ts: Date.now(), value, ttlMs });
}

function keyFromPair(from: Coords, to: Coords): string {
  // Redondeo suave para evitar cache-miss por ruido de GPS
  const r = (n: number) => Math.round(n * 1e5) / 1e5;
  return `${r(from.lat)},${r(from.lng)}|${r(to.lat)},${r(to.lng)}`;
}

function keyFromCoord(coord: Coords): string {
  const r = (n: number) => Math.round(n * 1e5) / 1e5;
  return `${r(coord.lat)},${r(coord.lng)}`;
}

function haversineMeters(from: Coords, to: Coords) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadius * c);
}

function sameCoord(a: Coords, b: Coords) {
  const r = (n: number) => Math.round(n * 1e5) / 1e5;
  return r(a.lat) === r(b.lat) && r(a.lng) === r(b.lng);
}

function withOriginalEndpoints(path: { latitude: number; longitude: number }[], from: Coords, to: Coords) {
  let nextPath = path.slice();

  if (!nextPath.length) return nextPath;
  if (!sameCoord({ lat: nextPath[0]!.latitude, lng: nextPath[0]!.longitude }, from)) {
    nextPath = [{ latitude: from.lat, longitude: from.lng }, ...nextPath];
  }
  if (!sameCoord({ lat: nextPath[nextPath.length - 1]!.latitude, lng: nextPath[nextPath.length - 1]!.longitude }, to)) {
    nextPath = [...nextPath, { latitude: to.lat, longitude: to.lng }];
  }

  return nextPath;
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<any | null> {
  const hasAbort = typeof (globalThis as any).AbortController !== "undefined";
  const controller = hasAbort ? new (globalThis as any).AbortController() : null;
  const id = setTimeout(() => {
    try {
      controller?.abort();
    } catch {
      // noop
    }
  }, timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller?.signal,
    } as any);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

function osrmBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_OSRM_BASE_URL;
  const base = (fromEnv && fromEnv.trim()) || "https://router.project-osrm.org";
  return base.replace(/\/$/, "");
}

function osrmBaseUrls(): string[] {
  return Array.from(new Set([osrmBaseUrl(), ...BUILTIN_OSRM_BASE_URLS].map((url) => url.replace(/\/$/, ""))));
}

async function fetchFirstJsonAgainstUrls(urls: string[], timeoutMs: number): Promise<any | null> {
  if (!urls.length) return null;

  return new Promise((resolve) => {
    let pending = urls.length;
    let done = false;

    for (const url of urls) {
      void fetchJsonWithTimeout(url, timeoutMs)
        .then((data) => {
          if (done || !data) return;
          done = true;
          resolve(data);
        })
        .finally(() => {
          pending -= 1;
          if (!done && pending <= 0) resolve(null);
        });
    }
  });
}

async function snapCoordToRoad(coord: Coords): Promise<Coords | null> {
  const cacheKey = keyFromCoord(coord);
  const cached = cacheGet(nearestCache, cacheKey);
  if (cached !== undefined) return cached;

  const urls = osrmBaseUrls().map((base) => `${base}/nearest/v1/driving/${coord.lng},${coord.lat}?number=1`);

  try {
    const data: any = await fetchFirstJsonAgainstUrls(urls, DEFAULT_ROUTE_TIMEOUT_MS);
    const location = data?.waypoints?.[0]?.location;
    const lng = location?.[0];
    const lat = location?.[1];

    if (typeof lat !== "number" || !Number.isFinite(lat) || typeof lng !== "number" || !Number.isFinite(lng)) {
      cacheSet(nearestCache, cacheKey, null, FAILURE_CACHE_TTL_MS);
      return null;
    }

    const snapped = { lat, lng };
    cacheSet(nearestCache, cacheKey, snapped);
    return snapped;
  } catch {
    cacheSet(nearestCache, cacheKey, null, FAILURE_CACHE_TTL_MS);
    return null;
  }
}

async function fetchDrivingRouteForPair(params: { from: Coords; to: Coords }): Promise<{ distanceMeters: number; durationSeconds: number; path: { latitude: number; longitude: number }[] } | null> {
  const urls = osrmBaseUrls().map(
    (base) => `${base}/route/v1/driving/${params.from.lng},${params.from.lat};${params.to.lng},${params.to.lat}?overview=simplified&geometries=geojson&alternatives=false&steps=false`
  );

  const data: any = await fetchFirstJsonAgainstUrls(urls, DEFAULT_ROUTE_TIMEOUT_MS);
  const route = data?.routes?.[0];
  const dist = route?.distance;
  const dur = route?.duration;
  const coords: any[] | undefined = route?.geometry?.coordinates;

  if (typeof dist !== "number" || !Number.isFinite(dist) || dist <= 0) return null;
  if (typeof dur !== "number" || !Number.isFinite(dur) || dur < 0) return null;
  if (!Array.isArray(coords) || coords.length < 2) return null;

  const path = coords
    .map((pair) => {
      const lng = pair?.[0];
      const lat = pair?.[1];
      if (typeof lat !== "number" || typeof lng !== "number") return null;
      return { latitude: lat, longitude: lng };
    })
    .filter(Boolean) as { latitude: number; longitude: number }[];

  if (path.length < 2) return null;

  return {
    distanceMeters: Math.round(dist),
    durationSeconds: Math.round(dur),
    path,
  };
}

async function fetchDrivingRouteDistanceForPair(params: { from: Coords; to: Coords }): Promise<number | null> {
  const urls = osrmBaseUrls().map(
    (base) => `${base}/route/v1/driving/${params.from.lng},${params.from.lat};${params.to.lng},${params.to.lat}?overview=false&alternatives=false&steps=false`
  );

  const data: any = await fetchFirstJsonAgainstUrls(urls, DEFAULT_ROUTE_TIMEOUT_MS);
  const dist = data?.routes?.[0]?.distance;
  if (typeof dist !== "number" || !Number.isFinite(dist) || dist <= 0) return null;
  return Math.round(dist);
}

export async function getDrivingRoute(params: { from: Coords; to: Coords }): Promise<{ distanceMeters: number; durationSeconds: number; path: { latitude: number; longitude: number }[] } | null> {
  const cacheKey = keyFromPair(params.from, params.to);
  const cached = cacheGet(routeCache, cacheKey);
  if (cached !== undefined) return cached;

  try {
    const directRoute = await fetchDrivingRouteForPair(params);
    if (directRoute) {
      cacheSet(routeCache, cacheKey, directRoute);
      return directRoute;
    }

    const [snappedFrom, snappedTo] = await Promise.all([snapCoordToRoad(params.from), snapCoordToRoad(params.to)]);
    if (!snappedFrom || !snappedTo) {
      cacheSet(routeCache, cacheKey, null, FAILURE_CACHE_TTL_MS);
      return null;
    }

    const snappedRoute = await fetchDrivingRouteForPair({ from: snappedFrom, to: snappedTo });
    if (!snappedRoute) {
      cacheSet(routeCache, cacheKey, null, FAILURE_CACHE_TTL_MS);
      return null;
    }

    const connectorMeters = haversineMeters(params.from, snappedFrom) + haversineMeters(params.to, snappedTo);
    const value = {
      distanceMeters: snappedRoute.distanceMeters + connectorMeters,
      durationSeconds: snappedRoute.durationSeconds,
      path: withOriginalEndpoints(snappedRoute.path, params.from, params.to),
    };
    cacheSet(routeCache, cacheKey, value);
    return value;
  } catch {
    cacheSet(routeCache, cacheKey, null, FAILURE_CACHE_TTL_MS);
    return null;
  }
}

export async function getDrivingRouteDistanceMeters(params: { from: Coords; to: Coords }): Promise<number | null> {
  const cacheKey = keyFromPair(params.from, params.to);
  const cached = cacheGet(distCache, cacheKey);
  if (cached !== undefined) return cached;

  try {
    const directDistance = await fetchDrivingRouteDistanceForPair(params);
    if (directDistance) {
      cacheSet(distCache, cacheKey, directDistance);
      return directDistance;
    }

    const [snappedFrom, snappedTo] = await Promise.all([snapCoordToRoad(params.from), snapCoordToRoad(params.to)]);
    if (!snappedFrom || !snappedTo) {
      cacheSet(distCache, cacheKey, null, FAILURE_CACHE_TTL_MS);
      return null;
    }

    const snappedDistance = await fetchDrivingRouteDistanceForPair({ from: snappedFrom, to: snappedTo });
    if (!snappedDistance) {
      cacheSet(distCache, cacheKey, null, FAILURE_CACHE_TTL_MS);
      return null;
    }

    const value = snappedDistance + haversineMeters(params.from, snappedFrom) + haversineMeters(params.to, snappedTo);
    cacheSet(distCache, cacheKey, value);
    return value;
  } catch {
    cacheSet(distCache, cacheKey, null, FAILURE_CACHE_TTL_MS);
    return null;
  }
}
