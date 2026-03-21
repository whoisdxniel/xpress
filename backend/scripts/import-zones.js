const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')

function usageAndExit() {
  // eslint-disable-next-line no-console
  console.log(
    'Uso: node scripts/import-zones.js [zonesDir]\n\n' +
      '- zonesDir: carpeta con archivos .geojson/.json (default: ../json/zones)\n' +
      "- Convención opcional: si el archivo empieza con 'hub__', la zona se crea como hub (SC).\n" +
      '  Ej: hub__san_cristobal.geojson'
  )
  process.exit(1)
}

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n)
}

function extractLngLatFromGeoJson(geojson) {
  if (!geojson || typeof geojson !== 'object') return []

  const type = geojson.type
  const coords = geojson.coordinates

  const out = []

  const pushPair = (pair) => {
    if (!Array.isArray(pair) || pair.length < 2) return
    const lng = pair[0]
    const lat = pair[1]
    if (isFiniteNumber(lng) && isFiniteNumber(lat)) out.push([lng, lat])
  }

  if (type === 'Polygon' && Array.isArray(coords)) {
    for (const ring of coords) {
      if (!Array.isArray(ring)) continue
      for (const pair of ring) pushPair(pair)
    }
  }

  if (type === 'MultiPolygon' && Array.isArray(coords)) {
    for (const poly of coords) {
      if (!Array.isArray(poly)) continue
      for (const ring of poly) {
        if (!Array.isArray(ring)) continue
        for (const pair of ring) pushPair(pair)
      }
    }
  }

  return out
}

function computeBboxFromGeoJson(geojson) {
  const pairs = extractLngLatFromGeoJson(geojson)
  if (!pairs.length) throw new Error('Invalid GeoJSON: empty coordinates')

  let minLng = Number.POSITIVE_INFINITY
  let minLat = Number.POSITIVE_INFINITY
  let maxLng = Number.NEGATIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY

  for (const [lng, lat] of pairs) {
    if (lng < minLng) minLng = lng
    if (lat < minLat) minLat = lat
    if (lng > maxLng) maxLng = lng
    if (lat > maxLat) maxLat = lat
  }

  if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) {
    throw new Error('Invalid GeoJSON: bbox not finite')
  }

  return { minLat, minLng, maxLat, maxLng }
}

function extractPolygonGeometry(input) {
  if (!input || typeof input !== 'object') return null

  if (input.type === 'Polygon' || input.type === 'MultiPolygon') return input

  if (input.type === 'Feature' && input.geometry) {
    const g = input.geometry
    if (g && (g.type === 'Polygon' || g.type === 'MultiPolygon')) return g
  }

  if (input.type === 'FeatureCollection' && Array.isArray(input.features)) {
    const first = input.features.find((f) => f && f.type === 'Feature' && f.geometry)
    const g = first && first.geometry
    if (g && (g.type === 'Polygon' || g.type === 'MultiPolygon')) return g
  }

  return null
}

function guessNameFromFilename(file) {
  const base = path.basename(file).replace(/\.(geojson|json)$/i, '')
  return base.replace(/^hub__/, '').replace(/[_-]+/g, ' ').trim()
}

async function main() {
  const arg = process.argv[2]

  // repoRoot/json/zones (repoRoot es padre de backend/)
  const defaultZonesDir = path.resolve(__dirname, '..', '..', 'json', 'zones')
  const zonesDir = arg ? path.resolve(process.cwd(), arg) : defaultZonesDir

  if (!fs.existsSync(zonesDir) || !fs.statSync(zonesDir).isDirectory()) {
    // eslint-disable-next-line no-console
    console.error('No existe la carpeta:', zonesDir)
    usageAndExit()
  }

  const files = fs
    .readdirSync(zonesDir)
    .filter((f) => /\.(geojson|json)$/i.test(f))
    .sort((a, b) => a.localeCompare(b))

  if (!files.length) {
    // eslint-disable-next-line no-console
    console.error('No hay archivos .geojson/.json en:', zonesDir)
    usageAndExit()
  }

  const prisma = new PrismaClient()

  for (const file of files) {
    const full = path.join(zonesDir, file)
    const raw = fs.readFileSync(full, 'utf8')

    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      // eslint-disable-next-line no-console
      console.warn('Saltando (JSON inválido):', file)
      continue
    }

    const geo = extractPolygonGeometry(parsed)
    if (!geo) {
      // eslint-disable-next-line no-console
      console.warn('Saltando (no es Polygon/MultiPolygon):', file)
      continue
    }

    const name =
      (parsed && parsed.properties && parsed.properties.name && String(parsed.properties.name).trim()) ||
      guessNameFromFilename(file)

    const isHub = /^hub__/i.test(path.basename(file))

    let bbox
    try {
      bbox = computeBboxFromGeoJson(geo)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Saltando (bbox inválido):', file, e && e.message)
      continue
    }

    const existing = await prisma.zone.findFirst({ where: { name } })

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
      })
      // eslint-disable-next-line no-console
      console.log('Actualizada zona:', name, isHub ? '(hub)' : '')
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
      })
      // eslint-disable-next-line no-console
      console.log('Creada zona:', name, isHub ? '(hub)' : '')
    }
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('import-zones error:', err)
  process.exit(1)
})
