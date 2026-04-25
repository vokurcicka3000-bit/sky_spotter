import type { Flight, AircraftSize } from './types'

// OpenSky Network REST API
// Authenticated users get 1000 req/day (vs ~100 anonymous).
// Set OPENSKY_USER and OPENSKY_PASS in .env.local to enable auth.
// State vector indices:
// 0: icao24, 1: callsign, 2: origin_country, 3: time_position, 4: last_contact,
// 5: longitude, 6: latitude, 7: baro_altitude, 8: on_ground, 9: velocity,
// 10: true_track, 11: vertical_rate, 12: sensors, 13: geo_altitude,
// 14: squawk, 15: spi, 16: position_source, 17: category

const OPENSKY_BASE = 'https://opensky-network.org/api'

// Server-side in-memory cache.
// OpenSky data updates every ~10s, so there's no point fetching more often.
// On 429 we back off and keep serving stale data rather than erroring.
interface CacheEntry { data: Flight[]; fetchedAt: number }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 15_000       // don't fetch more often than every 15 s
let rateLimitedUntil = 0          // epoch ms — don't retry before this time
const RATE_LIMIT_BACKOFF_MS = 60_000  // after a 429, wait 60 s before retrying

function authHeader(): string | undefined {
  const user = process.env.OPENSKY_USER
  const pass = process.env.OPENSKY_PASS
  if (!user || !pass) return undefined
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')
}

function parseStateVector(sv: unknown[]): Flight {
  return {
    icao24: sv[0] as string,
    callsign: sv[1] ? (sv[1] as string).trim() || null : null,
    originCountry: sv[2] as string,
    longitude: sv[5] as number | null,
    latitude: sv[6] as number | null,
    baroAltitude: sv[7] as number | null,
    onGround: sv[8] as boolean,
    velocity: sv[9] as number | null,
    trueTrack: sv[10] as number | null,
    verticalRate: sv[11] as number | null,
    squawk: sv[14] as string | null,
    category: (sv[17] as number) ?? 0,
  }
}

export interface FetchFlightsResult {
  flights: Flight[]
  rateLimited: boolean
  stale: boolean  // true when serving cached data after a 429
}

export async function fetchFlightsInBbox(
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number
): Promise<FetchFlightsResult> {
  const cacheKey = `${minLat.toFixed(3)},${maxLat.toFixed(3)},${minLon.toFixed(3)},${maxLon.toFixed(3)}`
  const cached = cache.get(cacheKey)
  const now = Date.now()

  // Serve from cache if still fresh
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return { flights: cached.data, rateLimited: false, stale: false }
  }

  // Still in backoff window — serve stale cache if available
  if (now < rateLimitedUntil) {
    return { flights: cached?.data ?? [], rateLimited: true, stale: cached != null }
  }

  const url = `${OPENSKY_BASE}/states/all?lamin=${minLat}&lamax=${maxLat}&lomin=${minLon}&lomax=${maxLon}`
  const headers: Record<string, string> = {}
  const auth = authHeader()
  if (auth) headers['Authorization'] = auth

  const res = await fetch(url, { headers, next: { revalidate: 0 } })

  if (res.status === 429) {
    rateLimitedUntil = now + RATE_LIMIT_BACKOFF_MS
    console.warn(`[opensky] 429 rate limited — backing off for ${RATE_LIMIT_BACKOFF_MS / 1000}s`)
    return { flights: cached?.data ?? [], rateLimited: true, stale: cached != null }
  }

  if (!res.ok) throw new Error(`OpenSky API error: ${res.status}`)

  const data = await res.json()
  const flights = data.states ? (data.states as unknown[][]).map(parseStateVector) : []

  cache.set(cacheKey, { data: flights, fetchedAt: now })
  return { flights, rateLimited: false, stale: false }
}

// Degrees to radians
function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

// Haversine distance in km
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Compute the closest approach of a flight to a fixed observer point.
 *
 * Uses flat-Earth approximation (good enough for < 500 km).
 * The flight moves in a straight line at constant speed and heading.
 * We find the parameter t* (seconds) at which the plane is closest,
 * then return:
 *   closestKm  – minimum distance in km (null if data missing)
 *   minutesUntilClosest – time until that moment in minutes (negative = already passed)
 */
export function closestApproach(
  flightLat: number,
  flightLon: number,
  trackDeg: number | null,
  velocityMs: number | null,
  userLat: number,
  userLon: number,
): { closestKm: number; minutesUntilClosest: number } | null {
  if (velocityMs === null || velocityMs < 1 || trackDeg === null) return null

  // Convert to local Cartesian (km), user at origin
  const kmPerLatDeg = 111.32
  const kmPerLonDeg = 111.32 * Math.cos(toRad(userLat))

  const px = (flightLon - userLon) * kmPerLonDeg   // plane x relative to user
  const py = (flightLat - userLat) * kmPerLatDeg   // plane y relative to user

  // Velocity vector in km/s
  const trackRad = toRad(trackDeg)
  const speedKmS = velocityMs / 1000
  const vx = Math.sin(trackRad) * speedKmS
  const vy = Math.cos(trackRad) * speedKmS

  // t* = -dot(p, v) / dot(v, v)
  const dotPV = px * vx + py * vy
  const dotVV = vx * vx + vy * vy
  const tStar = -dotPV / dotVV            // seconds

  // Closest point position
  const cx = px + vx * tStar
  const cy = py + vy * tStar
  const closestKm = Math.sqrt(cx * cx + cy * cy)

  const minutesUntilClosest = tStar / 60

  return { closestKm, minutesUntilClosest }
}

/**
 * Map ADS-B emitter category (DO-260B) to a size class.
 * Category 0 = no info; 1 = no ADS-B cat info; 2–3 = surface vehicles/reserved;
 * then the aircraft categories start at Set A (cat 1–7 → light/small/large/high-vortex/heavy/high-perf/rotorcraft)
 * repeated across sets B/C/D.
 * OpenSky returns the raw integer 0–19.
 */
export function categoryToSize(cat: number): AircraftSize {
  // Sets A-D each have 8 slots (indices 0-7 within the set).
  // Set A = cat 1-7 (after the 0 = no-info slot at index 0 of a set)
  // OpenSky uses: 0=no info, then the ADSB emitter cat directly from the transponder.
  // Empirically the values map as follows for commercial air traffic:
  switch (cat) {
    case 0:
    case 1:
      return 'unknown'
    // Set A
    case 2: return 'small'       // A1: light < 15 500 lb
    case 3: return 'small'       // A2: small 15 500–75 000 lb
    case 4: return 'large'       // A3: large 75 000–300 000 lb (narrow-body jets, B737/A320 class)
    case 5: return 'heavy'       // A4: high-vortex large (B757)
    case 6: return 'heavy'       // A5: heavy > 300 000 lb (B747/A380 class)
    case 7: return 'special'     // A6: high performance > 5g / > 400 kt
    // Set B
    case 8: return 'rotorcraft'  // B1
    case 9: return 'special'     // B2: glider / sailplane
    case 10: return 'special'    // B3: lighter-than-air
    case 11: return 'special'    // B4: skydiver / parachutist
    case 12: return 'special'    // B5: ultralight / hang-glider
    case 13: return 'unknown'    // B6: reserved
    case 14: return 'special'    // B7: UAV
    // Set C
    case 15: return 'unknown'    // C0: reserved
    case 16: return 'medium'     // C1: surface emergency vehicle
    case 17: return 'medium'     // C2: surface service vehicle
    case 18: return 'medium'     // C3: fixed ground obstruction
    case 19: return 'medium'     // C4-C7: reserved / obstacle
    default: return 'unknown'
  }
}

// ---- Route lookup -------------------------------------------------------
// Fetches departure/arrival airports for a given icao24.
// Results are cached for 1 hour — routes don't change mid-flight.
// Uses the OpenSky /flights/aircraft endpoint (counts against daily quota).

export interface FlightRoute {
  departure: string | null   // ICAO airport code, e.g. "EGLL"
  arrival: string | null
}

interface RouteCacheEntry { route: FlightRoute; fetchedAt: number }
const routeCache = new Map<string, RouteCacheEntry>()
const ROUTE_TTL_MS = 60 * 60 * 1000  // 1 hour

export async function fetchFlightRoute(icao24: string): Promise<FlightRoute> {
  const cached = routeCache.get(icao24)
  if (cached && Date.now() - cached.fetchedAt < ROUTE_TTL_MS) {
    return cached.route
  }

  // Look back 6 hours to catch the departure
  const end = Math.floor(Date.now() / 1000)
  const begin = end - 6 * 3600
  const url = `${OPENSKY_BASE}/flights/aircraft?icao24=${icao24}&begin=${begin}&end=${end}`
  const headers: Record<string, string> = {}
  const auth = authHeader()
  if (auth) headers['Authorization'] = auth

  try {
    const res = await fetch(url, { headers, next: { revalidate: 0 } })
    if (!res.ok) {
      routeCache.set(icao24, { route: { departure: null, arrival: null }, fetchedAt: Date.now() })
      return { departure: null, arrival: null }
    }
    const data = await res.json() as Array<{ estDepartureAirport?: string; estArrivalAirport?: string }>
    // Take the most recent flight entry
    const entry = data[data.length - 1]
    const route: FlightRoute = {
      departure: entry?.estDepartureAirport ?? null,
      arrival: entry?.estArrivalAirport ?? null,
    }
    routeCache.set(icao24, { route, fetchedAt: Date.now() })
    return route
  } catch {
    return { departure: null, arrival: null }
  }
}

// Build a bounding box around a center point with radius in km
export function bboxFromCenter(
  lat: number,
  lon: number,
  radiusKm: number
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const latDelta = radiusKm / 111
  const lonDelta = radiusKm / (111 * Math.cos(toRad(lat)))
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLon: lon - lonDelta,
    maxLon: lon + lonDelta,
  }
}
