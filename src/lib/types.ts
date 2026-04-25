export type AircraftSize =
  | 'heavy'      // wide-body: B747, A380, B777, A330…
  | 'large'      // narrow-body: B737, A320, B757…
  | 'medium'     // regional jets / turboprops
  | 'small'      // light GA / small props
  | 'rotorcraft' // helicopter
  | 'special'    // glider, UAV, ultralight, balloon…
  | 'unknown'

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
  // --- Spotter mode: user-centric fields ---
  distanceFromUserKm: number
  closestApproachKm: number | null
  minutesUntilClosest: number | null
  isDescending: boolean
  isRelevant: boolean
  aircraftSize: AircraftSize
  /** ICAO typecode from registration DB, e.g. "B738", "A320" */
  typecode?: string
  /** ICAO aircraft type string, e.g. "L2J", "H1T" */
  icaoType?: string
  /** Human-readable model name, e.g. "Boeing 737-800" */
  modelName?: string
}

