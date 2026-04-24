import type { Flight } from './types'

// OpenSky Network REST API - free, no key needed for anonymous (rate limited to ~100 req/day)
// State vector indices:
// 0: icao24, 1: callsign, 2: origin_country, 3: time_position, 4: last_contact,
// 5: longitude, 6: latitude, 7: baro_altitude, 8: on_ground, 9: velocity,
// 10: true_track, 11: vertical_rate, 12: sensors, 13: geo_altitude,
// 14: squawk, 15: spi, 16: position_source, 17: category

const OPENSKY_BASE = 'https://opensky-network.org/api'

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

export async function fetchFlightsInBbox(
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number
): Promise<Flight[]> {
  const url = `${OPENSKY_BASE}/states/all?lamin=${minLat}&lamax=${maxLat}&lomin=${minLon}&lomax=${maxLon}`
  const res = await fetch(url, { next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`OpenSky API error: ${res.status}`)
  const data = await res.json()
  if (!data.states) return []
  return (data.states as unknown[][]).map(parseStateVector)
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
