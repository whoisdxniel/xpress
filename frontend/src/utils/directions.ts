export type Coords = { lat: number; lng: number };

function osrmBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_OSRM_BASE_URL;
  const base = (fromEnv && fromEnv.trim()) || "https://router.project-osrm.org";
  return base.replace(/\/$/, "");
}

export async function getDrivingRoute(params: { from: Coords; to: Coords }): Promise<{ distanceMeters: number; path: { latitude: number; longitude: number }[] } | null> {
  const base = osrmBaseUrl();
  const url = `${base}/route/v1/driving/${params.from.lng},${params.from.lat};${params.to.lng},${params.to.lat}?overview=full&geometries=geojson&alternatives=false&steps=false`;

  try {
    const res = await fetch(url, { method: "GET", headers: { accept: "application/json" } });
    if (!res.ok) return null;

    const data: any = await res.json();
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

    return { distanceMeters: Math.round(dist), path };
  } catch {
    return null;
  }
}

export async function getDrivingRouteDistanceMeters(params: { from: Coords; to: Coords }): Promise<number | null> {
  const base = osrmBaseUrl();
  const url = `${base}/route/v1/driving/${params.from.lng},${params.from.lat};${params.to.lng},${params.to.lat}?overview=false&alternatives=false&steps=false`;

  try {
    const res = await fetch(url, { method: "GET", headers: { accept: "application/json" } });
    if (!res.ok) return null;

    const data: any = await res.json();
    const dist = data?.routes?.[0]?.distance;
    if (typeof dist !== "number" || !Number.isFinite(dist) || dist <= 0) return null;
    return Math.round(dist);
  } catch {
    return null;
  }
}
