export interface Flight {
  icao24: string
  callsign: string | null
  originCountry: string
  longitude: number | null
  latitude: number | null
  baroAltitude: number | null // metres
  onGround: boolean
  velocity: number | null // m/s
  trueTrack: number | null // degrees true
  verticalRate: number | null // m/s
  squawk: string | null
  category: number
}

export interface Airport {
  icao: string
  name: string
  city: string
  latitude: number
  longitude: number
  country: string
}

export interface NearbyAirport extends Airport {
  distanceKm: number
}

export interface FlightWithAirport extends Flight {
  // --- AirportFinder mode fields (still used there) ---
  nearestAirport?: NearbyAirport
  estimatedArrivalMin?: number

  // --- Spotter mode: user-centric fields ---
  distanceFromUserKm: number
  closestApproachKm: number | null       // minimum distance the flight will reach to the user
  minutesUntilClosest: number | null     // minutes until that closest point (negative = already past)
  isDescending: boolean
  isRelevant: boolean                    // low + descending + will pass reasonably close
}

export type AppMode = 'finder' | 'spotter'
