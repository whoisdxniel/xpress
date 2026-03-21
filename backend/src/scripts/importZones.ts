import fs from "node:fs";
import path from "node:path";
import { prisma } from "../db/prisma";
import { computeBboxFromGeoJson } from "../modules/zones/zones.service";

function usageAndExit() {
  // eslint-disable-next-line no-console
  console.log("Uso: tsx src/scripts/importZones.ts [zonesDir]\n\n" +
    "- zonesDir: carpeta con archivos .geojson/.json (default: ../json/zones)\n" +
    "- Convención opcional: si el archivo empieza con 'hub__', la zona se crea como hub (SC).\n" +
    "  Ej: hub__san_cristobal.geojson");
  process.exit(1);
}

function extractPolygonGeometry(input: any) {
  if (!input || typeof input !== "object") return null;

  if (input.type === "Polygon" || input.type === "MultiPolygon") return input;

  if (input.type === "Feature" && input.geometry) {
    const g = input.geometry;
    if (g?.type === "Polygon" || g?.type === "MultiPolygon") return g;
  }

  if (input.type === "FeatureCollection" && Array.isArray(input.features)) {
    const first = input.features.find((f: any) => f && f.type === "Feature" && f.geometry);
    const g = first?.geometry;
    if (g?.type === "Polygon" || g?.type === "MultiPolygon") return g;
  }

  return null;
}

function guessNameFromFilename(file: string) {
  const base = path.basename(file).replace(/\.(geojson|json)$/i, "");
  return base.replace(/^hub__/, "").replace(/[_-]+/g, " ").trim();
}

async function main() {
  const arg = process.argv[2];
  const zonesDir = arg ? path.resolve(process.cwd(), arg) : path.resolve(__dirname, "..", "..", "..", "json", "zones");

  if (!fs.existsSync(zonesDir) || !fs.statSync(zonesDir).isDirectory()) {
    // eslint-disable-next-line no-console
    console.error("No existe la carpeta:", zonesDir);
    usageAndExit();
  }

  const files = fs
    .readdirSync(zonesDir)
    .filter((f) => /\.(geojson|json)$/i.test(f))
    .sort((a, b) => a.localeCompare(b));

  if (!files.length) {
    // eslint-disable-next-line no-console
    console.error("No hay archivos .geojson/.json en:", zonesDir);
    usageAndExit();
  }

  for (const file of files) {
    const full = path.join(zonesDir, file);
    const raw = fs.readFileSync(full, "utf8");
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // eslint-disable-next-line no-console
      console.warn("Saltando (JSON inválido):", file);
      continue;
    }

    const geo = extractPolygonGeometry(parsed);
    if (!geo) {
      // eslint-disable-next-line no-console
      console.warn("Saltando (no es Polygon/MultiPolygon):", file);
      continue;
    }

    const name = (parsed?.properties?.name && String(parsed.properties.name).trim()) || guessNameFromFilename(file);
    const isHub = /^hub__/i.test(path.basename(file));

    let bbox;
    try {
      bbox = computeBboxFromGeoJson(geo);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.warn("Saltando (bbox inválido):", file, e?.message);
      continue;
    }

    const existing = await prisma.zone.findFirst({ where: { name } });

    if (existing) {
      await prisma.zone.update({
        where: { id: existing.id },
        data: {
          isHub,
          isActive: true,
          geojson: geo,
          minLat: bbox.minLat,
          minLng: bbox.minLng,
          maxLat: bbox.maxLat,
          maxLng: bbox.maxLng,
        },
      });
      // eslint-disable-next-line no-console
      console.log("Actualizada zona:", name, isHub ? "(hub)" : "");
    } else {
      await prisma.zone.create({
        data: {
          name,
          isHub,
          isActive: true,
          geojson: geo,
          minLat: bbox.minLat,
          minLng: bbox.minLng,
          maxLat: bbox.maxLat,
          maxLng: bbox.maxLng,
        },
      });
      // eslint-disable-next-line no-console
      console.log("Creada zona:", name, isHub ? "(hub)" : "");
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("importZones error:", err);
  process.exit(1);
});
