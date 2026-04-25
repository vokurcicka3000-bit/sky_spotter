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

/**
 * Map ICAO typecode to a human-readable manufacturer + model string.
 * Returns undefined if the typecode is not recognised.
 */
const TYPECODE_NAMES: Record<string, string> = {
  // Airbus narrow-body
  A318: 'Airbus A318', A319: 'Airbus A319', A320: 'Airbus A320', A321: 'Airbus A321',
  A20N: 'Airbus A320neo', A21N: 'Airbus A321neo', A19N: 'Airbus A319neo', A18N: 'Airbus A318',
  // Airbus wide-body
  A300: 'Airbus A300', A306: 'Airbus A300-600', A30B: 'Airbus A300B',
  A310: 'Airbus A310',
  A332: 'Airbus A330-200', A333: 'Airbus A330-300', A338: 'Airbus A330-800neo', A339: 'Airbus A330-900neo',
  A342: 'Airbus A340-200', A343: 'Airbus A340-300', A345: 'Airbus A340-500', A346: 'Airbus A340-600',
  A359: 'Airbus A350-900', A35K: 'Airbus A350-1000',
  A380: 'Airbus A380', A388: 'Airbus A380-800',
  A3ST: 'Airbus Beluga',
  // Airbus A220 (formerly Bombardier C-Series)
  A220: 'Airbus A220', A221: 'Airbus A220-100', A223: 'Airbus A220-300',
  BCS1: 'Airbus A220-100', BCS3: 'Airbus A220-300',
  // Boeing narrow-body
  B712: 'Boeing 717', B717: 'Boeing 717',
  B721: 'Boeing 727-100', B722: 'Boeing 727-200',
  B731: 'Boeing 737-100', B732: 'Boeing 737-200', B733: 'Boeing 737-300',
  B734: 'Boeing 737-400', B735: 'Boeing 737-500', B736: 'Boeing 737-600',
  B737: 'Boeing 737-700', B738: 'Boeing 737-800', B739: 'Boeing 737-900',
  B37M: 'Boeing 737 MAX 7', B38M: 'Boeing 737 MAX 8', B39M: 'Boeing 737 MAX 9',
  B3XM: 'Boeing 737 MAX 10',
  B752: 'Boeing 757-200', B753: 'Boeing 757-300',
  // Boeing wide-body
  B741: 'Boeing 747-100', B742: 'Boeing 747-200', B743: 'Boeing 747-300',
  B744: 'Boeing 747-400', B748: 'Boeing 747-8',
  BELF: 'Boeing 747 Dreamlifter',
  B762: 'Boeing 767-200', B763: 'Boeing 767-300', B764: 'Boeing 767-400',
  B772: 'Boeing 777-200', B773: 'Boeing 777-300',
  B77L: 'Boeing 777-200LR', B77W: 'Boeing 777-300ER',
  B778: 'Boeing 777X-8', B779: 'Boeing 777X-9',
  B787: 'Boeing 787', B788: 'Boeing 787-8', B789: 'Boeing 787-9', B78X: 'Boeing 787-10',
  // McDonnell Douglas
  DC85: 'McDonnell Douglas DC-8-50', DC86: 'McDonnell Douglas DC-8-60', DC87: 'McDonnell Douglas DC-8-70',
  DC91: 'McDonnell Douglas DC-9-10', DC92: 'McDonnell Douglas DC-9-20', DC93: 'McDonnell Douglas DC-9-30',
  DC94: 'McDonnell Douglas DC-9-40', DC95: 'McDonnell Douglas DC-9-50',
  MD11: 'McDonnell Douglas MD-11',
  MD80: 'McDonnell Douglas MD-80', MD81: 'McDonnell Douglas MD-81', MD82: 'McDonnell Douglas MD-82',
  MD83: 'McDonnell Douglas MD-83', MD87: 'McDonnell Douglas MD-87', MD88: 'McDonnell Douglas MD-88',
  MD90: 'McDonnell Douglas MD-90',
  DC10: 'McDonnell Douglas DC-10',
  // Embraer
  E135: 'Embraer ERJ-135', E140: 'Embraer ERJ-140', E145: 'Embraer ERJ-145',
  E170: 'Embraer E170', E175: 'Embraer E175', E190: 'Embraer E190', E195: 'Embraer E195',
  E75L: 'Embraer E175-E2', E75S: 'Embraer E175',
  E19P: 'Embraer E190-E2', E29N: 'Embraer E195-E2',
  // Bombardier CRJ
  CRJ1: 'Bombardier CRJ-100', CRJ2: 'Bombardier CRJ-200',
  CRJ7: 'Bombardier CRJ-700', CRJ9: 'Bombardier CRJ-900', CRJX: 'Bombardier CRJ-1000',
  // ATR
  AT43: 'ATR 42-300', AT44: 'ATR 42-400', AT45: 'ATR 42-500', AT46: 'ATR 42-600',
  AT72: 'ATR 72', AT73: 'ATR 72-200', AT75: 'ATR 72-500', AT76: 'ATR 72-600',
  // Dash 8 / Q-series
  DH8A: 'Bombardier Q100', DH8B: 'Bombardier Q200', DH8C: 'Bombardier Q300', DH8D: 'Bombardier Q400',
  // Fokker
  F50: 'Fokker 50', F70: 'Fokker 70', F100: 'Fokker 100',
  // Saab
  SB20: 'Saab 2000', SF34: 'Saab 340',
  // Antonov
  A124: 'Antonov An-124', A225: 'Antonov An-225',
  // Ilyushin
  IL86: 'Ilyushin Il-86', IL96: 'Ilyushin Il-96',
  // Tupolev
  T154: 'Tupolev Tu-154', T204: 'Tupolev Tu-204', T214: 'Tupolev Tu-214',
  // Comac
  C919: 'Comac C919',
  // Lockheed
  L101: 'Lockheed L-1011 TriStar',
  // Common helicopters
  B06: 'Bell 206', B212: 'Bell 212', B412: 'Bell 412',
  EC20: 'Airbus H120', EC25: 'Airbus H125', EC30: 'Airbus EC130',
  EC35: 'Airbus H135', EC45: 'Airbus H145', EC55: 'Airbus H155', EC75: 'Airbus H175',
  AS32: 'Airbus AS332 Super Puma', AS65: 'Airbus AS365 Dauphin',
  S61: 'Sikorsky S-61', S76: 'Sikorsky S-76', S92: 'Sikorsky S-92',
  R22: 'Robinson R22', R44: 'Robinson R44', R66: 'Robinson R66',
  MI8: 'Mil Mi-8', MI17: 'Mil Mi-17', MI26: 'Mil Mi-26',
  AW09: 'Leonardo AW09', AW13: 'Leonardo AW139', AW17: 'Leonardo AW169',
}

export function typecodeToName(typecode: string | undefined): string | undefined {
  if (!typecode) return undefined
  return TYPECODE_NAMES[typecode.toUpperCase()]
}
