/**
 * aircraftDb.ts
 *
 * Server-side module that loads the pre-built aircraft database and provides
 * fast ICAO24 → { typecode, icaoType } lookup.
 *
 * The JSON is built by: npx tsx scripts/build-aircraft-db.ts
 * It is stored at: <project-root>/data/aircraft-db.json
 * Format: { "ab1234": { "t": "B738", "i": "L2J" }, ... }
 *
 * Loaded once from disk at first use (not bundled — file stays on disk).
 */

import { readFileSync } from 'fs'
import path from 'path'

type DbRow = { t?: string; i?: string }
type AircraftDb = Record<string, DbRow>

let _db: AircraftDb | null = null

function loadDb(): AircraftDb {
  if (_db) return _db
  const dbPath = path.join(process.cwd(), 'data', 'aircraft-db.json')
  try {
    const raw = readFileSync(dbPath, 'utf8')
    _db = JSON.parse(raw) as AircraftDb
  } catch {
    console.warn('[aircraftDb] data/aircraft-db.json not found — run: npx tsx scripts/build-aircraft-db.ts')
    _db = {}
  }
  return _db
}

/** Returns { typecode, icaoType } for a given icao24 hex string, or undefined if unknown. */
export function lookupAircraft(icao24: string): { typecode?: string; icaoType?: string } | undefined {
  const db = loadDb()
  const row = db[icao24.toLowerCase()]
  if (!row) return undefined
  return { typecode: row.t, icaoType: row.i }
}
