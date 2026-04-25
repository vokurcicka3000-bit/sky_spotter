import { NextRequest, NextResponse } from 'next/server'
import { fetchFlightsInBbox, bboxFromCenter, haversineKm, closestApproach, categoryToSize } from '@/lib/opensky'
import { AIRPORTS } from '@/lib/airports'
import { lookupAircraft } from '@/lib/aircraftDb'
import { typecodeToSize } from '@/lib/typecodeToSize'
import type { NearbyAirport, FlightWithAirport } from '@/lib/types'

const DESCENDING_RATE_THRESHOLD = -1   // m/s — meaningfully sinking
const DEFAULT_MAX_ALT_M = 5000         // metres

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lon = parseFloat(searchParams.get('lon') ?? '')
  const radiusKm = parseFloat(searchParams.get('radius') ?? '80')
  const descendingOnly = searchParams.get('descendingOnly') === '1'
  const maxAltM = parseFloat(searchParams.get('maxAlt') ?? String(DEFAULT_MAX_ALT_M))
  // How close does a plane need to pass to count as "overhead" (km)
  // Default 2 km — the plane will literally cross above the user
  const maxPassKm = parseFloat(searchParams.get('maxPass') ?? '2')
  // Airport finder mode still needs airport data
  const mode = searchParams.get('mode') ?? 'spotter'

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: 'lat and lon are required' }, { status: 400 })
  }

  const bbox = bboxFromCenter(lat, lon, radiusKm)

  try {
    const { flights, rateLimited, stale } = await fetchFlightsInBbox(bbox.minLat, bbox.maxLat, bbox.minLon, bbox.maxLon)

    // Airport data only needed for finder mode
    let nearbyAirports: NearbyAirport[] = []
    if (mode === 'finder') {
      nearbyAirports = AIRPORTS
        .map((a) => ({ ...a, distanceKm: haversineKm(lat, lon, a.latitude, a.longitude) }))
        .filter((a) => a.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm)
    }

    const enriched: FlightWithAirport[] = flights
      .filter((f) => !f.onGround && f.latitude !== null && f.longitude !== null)
      .map((f) => {
        const distanceFromUserKm = haversineKm(lat, lon, f.latitude!, f.longitude!)
        const isDescending = f.verticalRate !== null && f.verticalRate < DESCENDING_RATE_THRESHOLD

        // Closest approach to the user's position
        const approach = closestApproach(
          f.latitude!, f.longitude!,
          f.trueTrack, f.velocity,
          lat, lon,
        )
        const closestApproachKm = approach?.closestKm ?? null
        const minutesUntilClosest = approach?.minutesUntilClosest ?? null

        // Relevant for spotter: low enough, and will pass within maxPassKm
        // (includes planes already overhead that haven't passed yet, or passing right now)
        const willPassClose = closestApproachKm !== null && closestApproachKm <= maxPassKm
        const notYetPassed = minutesUntilClosest === null || minutesUntilClosest > -5
        const isRelevant = willPassClose && notYetPassed

        // Airport finder: find nearest airport
        let nearestAirport: NearbyAirport | undefined
        let estimatedArrivalMin: number | undefined
        if (mode === 'finder') {
          let minAirportDist = Infinity
          for (const airport of nearbyAirports) {
            const d = haversineKm(f.latitude!, f.longitude!, airport.latitude, airport.longitude)
            if (d < minAirportDist) {
              minAirportDist = d
              nearestAirport = { ...airport, distanceKm: d }
            }
          }
          if (nearestAirport && f.velocity && f.velocity > 1) {
            const speedKmh = f.velocity * 3.6
            estimatedArrivalMin = Math.round((minAirportDist / speedKmh) * 60)
          }
        }

        // Aircraft size: prefer ADS-B category; fall back to registration DB lookup.
        // Always look up the DB for typecode (for display), even if category already gave a size.
        const dbEntry = lookupAircraft(f.icao24)
        const typecode = dbEntry?.typecode
        const icaoType = dbEntry?.icaoType
        let aircraftSize = categoryToSize(f.category)
        if (aircraftSize === 'unknown' && dbEntry) {
          aircraftSize = typecodeToSize(typecode, icaoType)
        }

        return {
          ...f,
          nearestAirport,
          estimatedArrivalMin,
          distanceFromUserKm,
          closestApproachKm,
          minutesUntilClosest,
          isDescending,
          isRelevant,
          aircraftSize,
          typecode,
          icaoType,
        }
      })

    // Apply filters
    const filtered = enriched.filter((f) => {
      if (f.baroAltitude !== null && f.baroAltitude > maxAltM) return false
      if (descendingOnly && !f.isDescending) return false
      // In spotter mode: only show flights that will actually cross overhead
      if (mode === 'spotter' && !f.isRelevant) return false
      return true
    })

    // Sort: relevant first, then by time-to-closest (soonest first), then by current distance
    filtered.sort((a, b) => {
      if (a.isRelevant !== b.isRelevant) return a.isRelevant ? -1 : 1
      const aTime = a.minutesUntilClosest ?? 9999
      const bTime = b.minutesUntilClosest ?? 9999
      if (Math.abs(aTime - bTime) > 0.5) return aTime - bTime
      return (a.distanceFromUserKm) - (b.distanceFromUserKm)
    })

    return NextResponse.json({ flights: filtered, airports: nearbyAirports, bbox, rateLimited, stale })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}
