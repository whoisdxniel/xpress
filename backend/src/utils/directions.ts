import { env } from "./env";

type Coords = { lat: number; lng: number };
export type RoutePathPoint = { lat: number; lng: number };

const DEFAULT_ROUTE_TIMEOUT_MS = 3200;
const DEFAULT_TABLE_TIMEOUT_MS = 3200;
const BUILTIN_OSRM_BASE_URLS = ["https://router.project-osrm.org", "https://routing.openstreetmap.de/routed-car"];

const CACHE_TTL_MS = 2 * 60 * 1000;
const CACHE_MAX = 800;

type CacheEntry<T> = { ts: number; value: T };
const routeCache = new Map<string, CacheEntry<{ distanceMeters: number; durationSeconds: number; path: RoutePathPoint[] } | null>>();
const distCache = new Map<string, CacheEntry<number | null>>();
const tableCache = new Map<string, CacheEntry<(number | null)[] | null>>();

function roundCoord(n: number) {
  // ~1m precision. Reduce keys distintos por jitter.
  return Math.round(n * 1e5) / 1e5;
}

function keyFromPair(from: Coords, to: Coords) {
  return `${roundCoord(from.lat)},${roundCoord(from.lng)}->${roundCoord(to.lat)},${roundCoord(to.lng)}`;
}

function pruneCache(map: Map<string, CacheEntry<any>>) {
  const now = Date.now();
  for (const [k, v] of map.entries()) {
    if (now - v.ts > CACHE_TTL_MS) map.delete(k);
  }
  if (map.size <= CACHE_MAX) return;
  // elimina los más viejos
  const entries = Array.from(map.entries()).sort((a, b) => a[1].ts - b[1].ts);
  const toDelete = Math.max(0, entries.length - CACHE_MAX);
  for (let i = 0; i < toDelete; i++) map.delete(entries[i]![0]);
}

function cacheGet<T>(map: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const e = map.get(key);
  if (!e) return undefined;
  if (Date.now() - e.ts > CACHE_TTL_MS) {
    map.delete(key);
    return undefined;
  }
  return e.value;
}

function cacheSet<T>(map: Map<string, CacheEntry<T>>, key: string, value: T) {
  map.set(key, { ts: Date.now(), value });
  pruneCache(map);
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<any | null> {
  const ms = Math.max(500, Math.floor(timeoutMs));
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function osrmBaseUrl(): string {
  return (env.OSRM_BASE_URL ?? "https://router.project-osrm.org").replace(/\/$/, "");
}

function osrmBaseUrls(): string[] {
  const preferred = osrmBaseUrl();
  return Array.from(new Set([preferred, ...BUILTIN_OSRM_BASE_URLS].map((url) => url.replace(/\/$/, ""))));
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

function downsamplePath(path: RoutePathPoint[], maxPoints: number) {
  const max = Math.max(2, Math.floor(maxPoints));
  if (path.length <= max) return path;

  const stride = Math.ceil(path.length / max);
  const out: RoutePathPoint[] = [];
  for (let i = 0; i < path.length; i += stride) out.push(path[i]);

  const last = path[path.length - 1];
  const lastOut = out[out.length - 1];
  if (!lastOut || lastOut.lat !== last.lat || lastOut.lng !== last.lng) out.push(last);

  return out.length > max ? out.slice(0, max) : out;
}

function parsePositiveInt(value: unknown) {
  const raw = Math.floor(Number(value));
  return Number.isFinite(raw) && raw > 0 ? raw : undefined;
}

export function normalizeRoutePathInput(routePath: unknown, maxPoints = 200): RoutePathPoint[] | null {
  if (!Array.isArray(routePath) || routePath.length < 2) return null;

  const rawPath = routePath
    .map((point) => {
      const lat = (point as any)?.lat;
      const lng = (point as any)?.lng;
      if (typeof lat !== "number" || !Number.isFinite(lat)) return null;
      if (typeof lng !== "number" || !Number.isFinite(lng)) return null;
      return { lat, lng };
    })
    .filter(Boolean) as RoutePathPoint[];

  if (rawPath.length < 2) return null;
  return downsamplePath(rawPath, maxPoints);
}

export async function resolveDrivingMetrics(params: {
  from: Coords;
  to: Coords;
  distanceMeters?: unknown;
  durationSeconds?: unknown;
  routePath?: unknown;
}): Promise<{ distanceMeters: number; durationSeconds?: number; path: RoutePathPoint[] | null } | null> {
  const providedDistance = parsePositiveInt(params.distanceMeters);
  const providedDuration = parsePositiveInt(params.durationSeconds);
  const providedPath = normalizeRoutePathInput(params.routePath);

  if (providedDistance && providedPath) {
    return {
      distanceMeters: providedDistance,
      durationSeconds: providedDuration,
      path: providedPath,
    };
  }

  const route = await getDrivingRoute({ from: params.from, to: params.to });
  if (route) {
    return {
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      path: route.path,
    };
  }

  const dist = await getDrivingRouteDistanceMeters({ from: params.from, to: params.to });
  if (!dist) return null;

  return {
    distanceMeters: dist,
    durationSeconds: providedDuration,
    path: providedPath,
  };
}

export async function getDrivingRoute(params: { from: Coords; to: Coords }): Promise<{ distanceMeters: number; durationSeconds: number; path: RoutePathPoint[] } | null> {
  const cacheKey = keyFromPair(params.from, params.to);
  const cached = cacheGet(routeCache, cacheKey);
  if (cached !== undefined) return cached;

  const urls = osrmBaseUrls().map(
    (base) => `${base}/route/v1/driving/${params.from.lng},${params.from.lat};${params.to.lng},${params.to.lat}?overview=full&geometries=geojson&alternatives=false&steps=false`
  );

  try {
    const data: any = await fetchFirstJsonAgainstUrls(urls, DEFAULT_ROUTE_TIMEOUT_MS);
    if (!data) {
      cacheSet(routeCache, cacheKey, null);
      return null;
    }
    const route = data?.routes?.[0];
    const dist = route?.distance;
    const dur = route?.duration;
    const coords: any[] | undefined = route?.geometry?.coordinates;

    if (typeof dist !== "number" || !Number.isFinite(dist) || dist <= 0) return null;
    if (typeof dur !== "number" || !Number.isFinite(dur) || dur < 0) return null;
    if (!Array.isArray(coords) || coords.length < 2) return null;

    const rawPath = coords
      .map((pair) => {
        const lng = pair?.[0];
        const lat = pair?.[1];
        if (typeof lat !== "number" || typeof lng !== "number") return null;
        return { lat, lng };
      })
      .filter(Boolean) as RoutePathPoint[];

    if (rawPath.length < 2) return null;

    const path = downsamplePath(rawPath, 200);
    const value = { distanceMeters: Math.round(dist), durationSeconds: Math.round(dur), path };
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

  const urls = osrmBaseUrls().map(
    (base) => `${base}/route/v1/driving/${params.from.lng},${params.from.lat};${params.to.lng},${params.to.lat}?overview=false&alternatives=false&steps=false`
  );

  try {
    const data: any = await fetchFirstJsonAgainstUrls(urls, DEFAULT_ROUTE_TIMEOUT_MS);
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

export async function getDrivingTableDistancesMeters(params: {
  from: Coords;
  toMany: Coords[];
}): Promise<(number | null)[] | null> {
  if (!params.toMany.length) return [];

  const cacheKey = `${roundCoord(params.from.lat)},${roundCoord(params.from.lng)}|${params.toMany
    .map((c) => `${roundCoord(c.lat)},${roundCoord(c.lng)}`)
    .join(";")}`;
  const cached = cacheGet(tableCache, cacheKey);
  if (cached !== undefined) return cached;

  const coords = [params.from, ...params.toMany]
    .map((c) => `${c.lng},${c.lat}`)
    .join(";");

  // OSRM Table: 1 source (index 0) -> N destinations.
  const destinations = params.toMany
    .map((_, idx) => String(idx + 1))
    .join(";");

  const urls = osrmBaseUrls().map(
    (base) => `${base}/table/v1/driving/${coords}?sources=0&destinations=${destinations}&annotations=distance`
  );

  try {
    const data: any = await fetchFirstJsonAgainstUrls(urls, DEFAULT_TABLE_TIMEOUT_MS);
    if (!data) {
      cacheSet(tableCache, cacheKey, null);
      return null;
    }
    const distances: any = data?.distances;

    const row0 = Array.isArray(distances) ? distances?.[0] : null;
    if (!Array.isArray(row0)) return null;

    const out = row0.map((d: any) => {
      if (d === null) return null;
      if (typeof d !== "number" || !Number.isFinite(d) || d <= 0) return null;
      return Math.round(d);
    });

    if (out.length !== params.toMany.length) {
      cacheSet(tableCache, cacheKey, null);
      return null;
    }
    cacheSet(tableCache, cacheKey, out);
    return out;
  } catch {
    cacheSet(tableCache, cacheKey, null);
    return null;
  }
}
