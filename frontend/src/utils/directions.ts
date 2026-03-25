export type Coords = { lat: number; lng: number };

const DEFAULT_ROUTE_TIMEOUT_MS = 12_000;
const DEFAULT_ROUTE_RETRY_TIMEOUT_MS = 20_000;
const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 250;

type CacheEntry<T> = { ts: number; value: T };

const routeCache = new Map<string, CacheEntry<{ distanceMeters: number; path: { latitude: number; longitude: number }[] } | null>>();
const distCache = new Map<string, CacheEntry<number | null>>();

function cacheGet<T>(map: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = map.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    map.delete(key);
    return undefined;
  }
  return entry.value;
}

function cacheSet<T>(map: Map<string, CacheEntry<T>>, key: string, value: T) {
  if (map.size >= CACHE_MAX) {
    // simple: borra el primero insertado
    const firstKey = map.keys().next().value as string | undefined;
    if (firstKey) map.delete(firstKey);
  }
  map.set(key, { ts: Date.now(), value });
}

function keyFromPair(from: Coords, to: Coords): string {
  // Redondeo suave para evitar cache-miss por ruido de GPS
  const r = (n: number) => Math.round(n * 1e5) / 1e5;
  return `${r(from.lat)},${r(from.lng)}|${r(to.lat)},${r(to.lng)}`;
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

export async function getDrivingRoute(params: { from: Coords; to: Coords }): Promise<{ distanceMeters: number; path: { latitude: number; longitude: number }[] } | null> {
  const cacheKey = keyFromPair(params.from, params.to);
  const cached = cacheGet(routeCache, cacheKey);
  if (cached !== undefined) return cached;

  const base = osrmBaseUrl();
  const url = `${base}/route/v1/driving/${params.from.lng},${params.from.lat};${params.to.lng},${params.to.lat}?overview=full&geometries=geojson&alternatives=false&steps=false`;

  try {
    const data: any = (await fetchJsonWithTimeout(url, DEFAULT_ROUTE_TIMEOUT_MS)) ?? (await fetchJsonWithTimeout(url, DEFAULT_ROUTE_RETRY_TIMEOUT_MS));
    if (!data) {
      cacheSet(routeCache, cacheKey, null);
      return null;
    }
    const route = data?.routes?.[0];
    const dist = route?.distance;
    const coords: any[] | undefined = route?.geometry?.coordinates;

    if (typeof dist !== "number" || !Number.isFinite(dist) || dist <= 0) return null;
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

    const value = { distanceMeters: Math.round(dist), path };
    cacheSet(routeCache, cacheKey, value);
    return value;
  } catch {
    cacheSet(routeCache, cacheKey, null);
    return null;
  }
}

export async function getDrivingRouteDistanceMeters(params: { from: Coords; to: Coords }): Promise<number | null> {
  const cacheKey = keyFromPair(params.from, params.to);
  const cached = cacheGet(distCache, cacheKey);
  if (cached !== undefined) return cached;

  const base = osrmBaseUrl();
  const url = `${base}/route/v1/driving/${params.from.lng},${params.from.lat};${params.to.lng},${params.to.lat}?overview=false&alternatives=false&steps=false`;

  try {
    const data: any = (await fetchJsonWithTimeout(url, DEFAULT_ROUTE_TIMEOUT_MS)) ?? (await fetchJsonWithTimeout(url, DEFAULT_ROUTE_RETRY_TIMEOUT_MS));
    if (!data) {
      cacheSet(distCache, cacheKey, null);
      return null;
    }
    const dist = data?.routes?.[0]?.distance;
    if (typeof dist !== "number" || !Number.isFinite(dist) || dist <= 0) {
      cacheSet(distCache, cacheKey, null);
      return null;
    }

    const value = Math.round(dist);
    cacheSet(distCache, cacheKey, value);
    return value;
  } catch {
    cacheSet(distCache, cacheKey, null);
    return null;
  }
}
