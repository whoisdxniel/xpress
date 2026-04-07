import { getMapboxAccessToken } from "./runtime";

export type MapStyleMode = "mapbox" | "fallback";

const MAPBOX_STYLE_PROBE_URL = "https://api.mapbox.com/styles/v1/mapbox/streets-v11?access_token=";
const MAPBOX_STYLE_PROBE_TIMEOUT_MS = 4000;

const OPEN_RASTER_STYLE_JSON = JSON.stringify({
  version: 8,
  name: "xpress-open-raster-fallback",
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
});

let cachedStyleMode: MapStyleMode | null = null;
let pendingStyleMode: Promise<MapStyleMode> | null = null;
let loggedFallbackReason = false;

function logFallbackReason(message: string) {
  if (loggedFallbackReason) return;
  loggedFallbackReason = true;
  console.warn("[mapbox]", message);
}

function withTimeout(signalTimeoutMs: number) {
  const hasAbort = typeof (globalThis as any).AbortController !== "undefined";
  const controller = hasAbort ? new (globalThis as any).AbortController() : null;
  const timeoutId = setTimeout(() => {
    try {
      controller?.abort();
    } catch {
      // noop
    }
  }, signalTimeoutMs);

  return {
    signal: controller?.signal,
    done() {
      clearTimeout(timeoutId);
    },
  };
}

export function getFallbackMapStyleJSON(): string {
  return OPEN_RASTER_STYLE_JSON;
}

export function getCachedMapStyleMode(): MapStyleMode {
  return cachedStyleMode ?? "mapbox";
}

export function forceFallbackMapStyle(): MapStyleMode {
  logFallbackReason("Usando estilo raster fallback para mantener el mapa operativo.");
  cachedStyleMode = "fallback";
  pendingStyleMode = Promise.resolve("fallback");
  return cachedStyleMode;
}

export async function resolveMapStyleMode(): Promise<MapStyleMode> {
  if (cachedStyleMode) return cachedStyleMode;
  if (pendingStyleMode) return pendingStyleMode;

  pendingStyleMode = (async () => {
    const token = getMapboxAccessToken();
    if (!token) {
      logFallbackReason("No hay token runtime de Mapbox disponible; se usara estilo raster fallback.");
      cachedStyleMode = "fallback";
      return cachedStyleMode;
    }

    const timeout = withTimeout(MAPBOX_STYLE_PROBE_TIMEOUT_MS);

    try {
      const response = await fetch(`${MAPBOX_STYLE_PROBE_URL}${encodeURIComponent(token)}`, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: timeout.signal,
      } as any);

      if (!response.ok) {
        logFallbackReason(`El token runtime de Mapbox respondio ${response.status}; se usara estilo raster fallback.`);
      }
      cachedStyleMode = response.ok ? "mapbox" : "fallback";
      return cachedStyleMode;
    } catch {
      logFallbackReason("No se pudo validar el estilo de Mapbox; se usara estilo raster fallback.");
      cachedStyleMode = "fallback";
      return cachedStyleMode;
    } finally {
      timeout.done();
      pendingStyleMode = null;
    }
  })();

  return pendingStyleMode;
}