/**
 * typecodeToSize.ts
 *
 * Maps an ICAO typecode (e.g. "B738", "A320", "B744") or
 * ICAO aircraft type string (e.g. "L2J", "L4J", "H1T") to AircraftSize.
 *
 * Typecodes are matched against known prefixes/exact codes.
 * ICAO type field encodes: L=landplane, H=helicopter, G=glider etc.
 * followed by engine count and engine type (J=jet, T=turboprop, P=piston, E=electric).
 */

import type { AircraftSize } from './types'

// ---- Known heavy (wide-body) typecode prefixes / exact codes ----
const HEAVY_PREFIXES = [
  'A30', 'A31', 'A32', // A300, A310, A320 families — wait, A320 is narrow-body
  // We'll list wide-bodies explicitly below
]

// Wide-body jets (heavy)
const HEAVY_EXACT: Set<string> = new Set([
  // Airbus wide-body
  'A300', 'A306', 'A30B',
  'A310', 'A3ST',
  'A332', 'A333', 'A338', 'A339', // A330
  'A342', 'A343', 'A345', 'A346', // A340
  'A359', 'A35K',                  // A350
  'A380', 'A388',                  // A380
  // Boeing wide-body
  'B741', 'B742', 'B743', 'B744', 'B748', 'BELF', // B747
  'B762', 'B763', 'B764',          // B767
  'B772', 'B773', 'B77L', 'B77W', 'B778', 'B779', // B777
  'B787', 'B788', 'B789', 'B78X', // B787
  // McDonnell Douglas / Boeing wide-body
  'DC10', 'MD11',
  // Lockheed
  'L101',
  // Ilyushin wide-body
  'IL86', 'IL96',
  // Others
  'A124', 'A225',                  // Antonov heavies
])

// Narrow-body jets (large)
const LARGE_EXACT: Set<string> = new Set([
  // Airbus narrow-body
  'A318', 'A319', 'A320', 'A321', 'A21N', 'A20N', 'A19N', 'A18N',
  // Boeing narrow-body
  'B712', 'B717',
  'B721', 'B722',
  'B731', 'B732', 'B733', 'B734', 'B735', 'B736', 'B737', 'B738', 'B739', 'B37M', 'B38M', 'B39M',
  'B752', 'B753',
  // McDonnell Douglas narrow-body
  'DC85', 'DC86', 'DC87', 'DC9', 'MD80', 'MD81', 'MD82', 'MD83', 'MD87', 'MD88', 'MD90',
  // Embraer E-Jet (larger)
  'E170', 'E175', 'E190', 'E195', 'E7W', 'E75L', 'E75S', 'E19P', 'E190',
  // Bombardier C-Series / Airbus A220
  'BCS1', 'BCS3', 'A220', 'A221', 'A223',
  // Comac
  'C919',
  // Tupolev narrow-body jets
  'T154', 'T204', 'T214',
])

// Regional jets / turboprops (medium)
const MEDIUM_EXACT: Set<string> = new Set([
  // Embraer regional
  'E135', 'E145', 'E140', 'E120', 'E121', 'E50P',
  'E170', 'ERJ1', 'ERJ4', 'ERJ5', 'ERJ7',
  // Bombardier CRJ
  'CRJ1', 'CRJ2', 'CRJ7', 'CRJ9', 'CRJX', 'CL60',
  // ATR
  'AT43', 'AT44', 'AT45', 'AT46', 'AT72', 'AT73', 'AT75', 'AT76',
  // Dash 8 / Q-series
  'DH8A', 'DH8B', 'DH8C', 'DH8D', 'DHC8',
  // Fokker
  'F50', 'F70', 'F100',
  // Saab
  'SB20', 'SF34',
  // Cessna Citation jets
  'C25A', 'C25B', 'C25C', 'C510', 'C525', 'C55B', 'C560', 'C56X', 'C680', 'C700', 'C750',
  // Other business jets often regional size
  'LJ31', 'LJ35', 'LJ40', 'LJ45', 'LJ60',
  'GLF3', 'GLF4', 'GLF5', 'GLF6',
  'FA50', 'FA7X', 'F2TH',
  'E545', 'E550',
])

// Helicopter typecodes
const HELO_PREFIXES = ['AS3', 'AS5', 'EC1', 'EC2', 'EC3', 'EC4', 'EC5', 'EC6', 'EC7', 'AW1', 'AW1', 'B06', 'B07', 'B21', 'H60', 'S61', 'S76', 'R22', 'R44', 'R66']
const HELO_EXACT: Set<string> = new Set([
  'B06', 'B07', 'B212', 'B214', 'B222', 'B230', 'B412',
  'EC20', 'EC25', 'EC30', 'EC35', 'EC45', 'EC55', 'EC75',
  'AS32', 'AS35', 'AS50', 'AS55', 'AS65',
  'AW09', 'AW13', 'AW17', 'AW19',
  'H47', 'H500', 'H60', 'H64',
  'R22', 'R44', 'R66',
  'S61', 'S76', 'S92',
  'MI8', 'MI17', 'MI26',
])

/**
 * Derive AircraftSize from ICAO typecode (e.g. "B738") and/or
 * ICAO aircraft type string (e.g. "L2J", "H1T").
 */
export function typecodeToSize(typecode: string | undefined, icaoType: string | undefined): AircraftSize {
  // Try ICAO type field first: it encodes category structurally
  if (icaoType) {
    const firstChar = icaoType[0]?.toUpperCase()
    if (firstChar === 'H') return 'rotorcraft'
    if (firstChar === 'G') return 'special'  // glider
    if (firstChar === 'B') return 'special'  // balloon
    if (firstChar === 'A') return 'special'  // amphibian
    // For landplanes/seaplanes: L/S + engine count + engine type
    // engine type: J=jet, T=turboprop, P=piston, E=electric
    const engineType = icaoType[2]?.toUpperCase()
    const engineCount = parseInt(icaoType[1] ?? '0', 10)
    if (engineType === 'J' && engineCount >= 4) {
      // 4-engine jet — likely wide-body (but could also be narrow like B741)
      // Fall through to typecode check for precision
    }
    if (engineType === 'P' || engineType === 'E') return 'small'   // piston/electric → small
    // Turboprops: could be medium (ATR) or small — rely on typecode
  }

  if (!typecode) {
    // Only icaoType available, use coarse heuristic
    if (icaoType) {
      const engineType = icaoType[2]?.toUpperCase()
      if (engineType === 'P' || engineType === 'E') return 'small'
      if (engineType === 'T') return 'medium'  // turboprop → medium
    }
    return 'unknown'
  }

  const tc = typecode.toUpperCase()

  if (HEAVY_EXACT.has(tc)) return 'heavy'
  if (LARGE_EXACT.has(tc)) return 'large'
  if (MEDIUM_EXACT.has(tc)) return 'medium'
  if (HELO_EXACT.has(tc)) return 'rotorcraft'

  // Prefix matching
  // Boeing 7x7: B7 prefix
  if (/^B7\d\d/.test(tc)) {
    // 4-engine or double-deck → heavy; 2-engine narrow → large
    if (['B741','B742','B743','B744','B748'].some(h => tc.startsWith(h.slice(0,4)))) return 'heavy'
    if (['B762','B763','B764','B772','B773','B77','B78','B788','B789'].some(h => tc.startsWith(h.slice(0,3)))) return 'heavy'
    return 'large' // default B7xx to large
  }
  // Airbus A3xx
  if (/^A3\d\d/.test(tc)) {
    if (HEAVY_EXACT.has(tc)) return 'heavy'
    if (LARGE_EXACT.has(tc)) return 'large'
    return 'large'
  }

  // ICAO type heuristics as last resort
  if (icaoType) {
    const engineType = icaoType[2]?.toUpperCase()
    if (engineType === 'T') return 'medium'
    if (engineType === 'J') return 'large'  // unknown jet → large (conservative)
  }

  return 'unknown'
}
