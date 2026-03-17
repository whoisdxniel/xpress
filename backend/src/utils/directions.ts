import { env } from "./env";

type Coords = { lat: number; lng: number };
export type RoutePathPoint = { lat: number; lng: number };

function osrmBaseUrl(): string {
  return (env.OSRM_BASE_URL ?? "https://router.project-osrm.org").replace(/\/$/, "");
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

export async function getDrivingRoute(params: { from: Coords; to: Coords }): Promise<{ distanceMeters: number; durationSeconds: number; path: RoutePathPoint[] } | null> {
  const base = osrmBaseUrl();
  const url = `${base}/route/v1/driving/${params.from.lng},${params.from.lat};${params.to.lng},${params.to.lat}?overview=full&geometries=geojson&alternatives=false&steps=false`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;

    const data: any = await res.json();
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
    return { distanceMeters: Math.round(dist), durationSeconds: Math.round(dur), path };
  } catch {
    return null;
  }
}

export async function getDrivingRouteDistanceMeters(params: { from: Coords; to: Coords }): Promise<number | null> {
  const base = osrmBaseUrl();
  const url = `${base}/route/v1/driving/${params.from.lng},${params.from.lat};${params.to.lng},${params.to.lat}?overview=false&alternatives=false&steps=false`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "accept": "application/json" },
    });

    if (!res.ok) return null;

    const data: any = await res.json();
    const dist = data?.routes?.[0]?.distance;
    if (typeof dist !== "number" || !Number.isFinite(dist) || dist <= 0) return null;
    return Math.round(dist);
  } catch {
    return null;
  }
}

export async function getDrivingTableDistancesMeters(params: {
  from: Coords;
  toMany: Coords[];
}): Promise<(number | null)[] | null> {
  if (!params.toMany.length) return [];

  const base = osrmBaseUrl();
  const coords = [params.from, ...params.toMany]
    .map((c) => `${c.lng},${c.lat}`)
    .join(";");

  // OSRM Table: 1 source (index 0) -> N destinations.
  const destinations = params.toMany
    .map((_, idx) => String(idx + 1))
    .join(";");

  const url = `${base}/table/v1/driving/${coords}?sources=0&destinations=${destinations}&annotations=distance`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
    });

    if (!res.ok) return null;

    const data: any = await res.json();
    const distances: any = data?.distances;

    const row0 = Array.isArray(distances) ? distances?.[0] : null;
    if (!Array.isArray(row0)) return null;

    const out = row0.map((d: any) => {
      if (d === null) return null;
      if (typeof d !== "number" || !Number.isFinite(d) || d <= 0) return null;
      return Math.round(d);
    });

    if (out.length !== params.toMany.length) return null;
    return out;
  } catch {
    return null;
  }
}
