/**
 * build-aircraft-db.ts
 *
 * Downloads the OpenSky aircraft metadata CSV and extracts a compact
 * icao24 → { typecode, icaoType } mapping, written to src/data/aircraft-db.json.
 *
 * Run once (or whenever you want a fresh DB):
 *   npx tsx scripts/build-aircraft-db.ts
 *
 * Output format:
 *   { "ab1234": { "t": "B738", "i": "L2J" }, ... }
 * where "t" = typecode (e.g. "B738", "A320") and "i" = ICAO aircraft type (e.g. "L2J")
 */

import { createWriteStream, mkdirSync } from 'fs'
import { writeFileSync } from 'fs'
import { createInterface } from 'readline'
import { get as httpsGet } from 'https'
import path from 'path'

const CSV_URL = 'https://s3.opensky-network.org/data-samples/metadata/aircraftDatabase.csv'
const OUT_DIR = path.join(import.meta.dirname, '..', 'data')
const OUT_FILE = path.join(OUT_DIR, 'aircraft-db.json')

type Row = { t?: string; i?: string }

function fetchStream(url: string): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    httpsGet(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        fetchStream(res.headers.location!).then(resolve, reject)
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        return
      }
      resolve(res)
    }).on('error', reject)
  })
}

async function main() {
  console.log('Downloading aircraft database CSV…')
  const stream = await fetchStream(CSV_URL)

  const rl = createInterface({ input: stream as NodeJS.ReadableStream, crlfDelay: Infinity })

  const db: Record<string, Row> = {}
  let lineNum = 0
  let header: string[] = []

  for await (const line of rl) {
    lineNum++
    // Simple CSV parse (fields are quoted, no embedded newlines in these fields)
    const fields = line.split('","').map((f) => f.replace(/^"|"$/g, ''))

    if (lineNum === 1) {
      header = fields
      continue
    }

    const icao24 = fields[header.indexOf('icao24')]?.trim().toLowerCase()
    if (!icao24) continue

    const typecode = fields[header.indexOf('typecode')]?.trim()
    const icaoType = fields[header.indexOf('icaoaircrafttype')]?.trim()

    const row: Row = {}
    if (typecode) row.t = typecode
    if (icaoType) row.i = icaoType

    if (row.t || row.i) {
      db[icao24] = row
    }

    if (lineNum % 100000 === 0) {
      process.stdout.write(`  …${lineNum.toLocaleString()} rows processed\r`)
    }
  }

  console.log(`\nProcessed ${lineNum.toLocaleString()} rows, kept ${Object.keys(db).length.toLocaleString()} entries.`)

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(OUT_FILE, JSON.stringify(db))
  console.log(`Written to ${OUT_FILE}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
