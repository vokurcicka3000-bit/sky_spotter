'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { FlightWithAirport, NearbyAirport } from '@/lib/types'
import FlightTable from '@/components/FlightTable'

const FlightMap = dynamic(() => import('@/components/FlightMap'), { ssr: false })

interface ApiResponse {
  flights: FlightWithAirport[]
  airports: NearbyAirport[]
  rateLimited?: boolean
  stale?: boolean
  error?: string
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{label}</div>
      <div className="font-mono text-sm text-gray-800 dark:text-gray-200">{value}</div>
    </div>
  )
}

export default function SpotterMode() {
  const [lat, setLat] = useState<string>('')
  const [lon, setLon] = useState<string>('')
  const [radius, setRadius] = useState<string>('80')
  const [maxAlt, setMaxAlt] = useState<string>('5000')
  const [maxPass, setMaxPass] = useState<string>('2')
  const [landingOnly, setLandingOnly] = useState<boolean>(true)

  const [flights, setFlights] = useState<FlightWithAirport[]>([])
  const [airports, setAirports] = useState<NearbyAirport[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState(false)
  const [highlightIcao, setHighlightIcao] = useState<string | null>(null)
  const [selectedFlight, setSelectedFlight] = useState<FlightWithAirport | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [locating, setLocating] = useState(false)
  const [active, setActive] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const userLocation: [number, number] | null =
    lat && lon && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lon))
      ? [parseFloat(lat), parseFloat(lon)]
      : null

  const fetchData = useCallback(async () => {
    const parsedLat = parseFloat(lat)
    const parsedLon = parseFloat(lon)
    const parsedRadius = parseFloat(radius)
    const parsedMaxAlt = parseFloat(maxAlt)
    const parsedMaxPass = parseFloat(maxPass)
    if (isNaN(parsedLat) || isNaN(parsedLon) || isNaN(parsedRadius)) return

    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        lat: String(parsedLat),
        lon: String(parsedLon),
        radius: String(parsedRadius),
        maxAlt: String(isNaN(parsedMaxAlt) ? 5000 : parsedMaxAlt),
        maxPass: String(isNaN(parsedMaxPass) ? 2 : parsedMaxPass),
        descendingOnly: landingOnly ? '1' : '0',
        mode: 'spotter',
      })
      const res = await fetch(`/api/flights?${params}`)
      const data: ApiResponse = await res.json()
      if (data.error) throw new Error(data.error)
      setFlights(data.flights)
      setAirports(data.airports)
      setRateLimited(data.rateLimited ?? false)
      setLastRefresh(new Date())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [lat, lon, radius, maxAlt, maxPass, landingOnly])

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    fetchData()
    intervalRef.current = setInterval(fetchData, 5000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [active, fetchData])

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not available. Make sure you are accessing this page over HTTPS.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(5))
        setLon(pos.coords.longitude.toFixed(5))
        setLocating(false)
      },
      (err) => {
        setLocating(false)
        if (err.code === err.PERMISSION_DENIED) {
          setError('Location blocked. On iPhone: Settings → Privacy & Security → Location Services → Safari → Allow While Using App. Then reload this page.')
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError('Location unavailable. Try moving to an area with better signal, or enter coordinates manually.')
        } else if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
          setError('Geolocation requires HTTPS. Access via your Tailscale HTTPS address.')
        } else {
          setError(`Location error (code ${err.code}): ${err.message}`)
        }
      }
    )
  }

  const handleStart = () => {
    const parsedLat = parseFloat(lat)
    const parsedLon = parseFloat(lon)
    if (isNaN(parsedLat) || isNaN(parsedLon)) {
      setError('Please enter valid coordinates or use the locate button.')
      return
    }
    setError(null)
    setActive(true)
  }

  const handleStop = () => {
    setActive(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  const relevantCount = flights.filter((f) => f.isRelevant).length

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500">Latitude</label>
            <input
              type="number"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="e.g. 50.0880"
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800"
              step="0.0001"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500">Longitude</label>
            <input
              type="number"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              placeholder="e.g. 14.4208"
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800"
              step="0.0001"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500">Radius (km)</label>
            <input
              type="number"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              min="10"
              max="300"
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500">Max altitude (m)</label>
            <select
              value={maxAlt}
              onChange={(e) => setMaxAlt(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800"
            >
              <option value="1000">1 000 m (~3 300 ft)</option>
              <option value="2000">2 000 m (~6 500 ft)</option>
              <option value="3000">3 000 m (~10 000 ft)</option>
              <option value="5000">5 000 m (~16 500 ft)</option>
              <option value="10000">10 000 m (any)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500">Pass within (km)</label>
            <select
              value={maxPass}
              onChange={(e) => setMaxPass(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800"
            >
              <option value="0.5">0.5 km (overhead)</option>
              <option value="1">1 km</option>
              <option value="2">2 km</option>
              <option value="5">5 km</option>
              <option value="10">10 km</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500">Filter</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none py-2">
              <input
                type="checkbox"
                checked={landingOnly}
                onChange={(e) => setLandingOnly(e.target.checked)}
                className="w-5 h-5 rounded"
              />
              Descending only
            </label>
          </div>
        </div>

        {/* Action buttons row */}
        <div className="flex flex-wrap gap-3 mt-4 items-center">
          <button
            onClick={handleLocate}
            disabled={locating}
            className="flex-1 sm:flex-none px-4 py-3 text-sm font-medium bg-gray-100 dark:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-500 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {locating ? 'Locating…' : '📍 My location'}
          </button>

          {!active ? (
            <button
              onClick={handleStart}
              className="flex-1 sm:flex-none px-5 py-3 text-sm font-semibold bg-emerald-600 active:bg-emerald-800 text-white rounded-lg transition-colors cursor-pointer"
            >
              ▶ Start Scanning
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="flex-1 sm:flex-none px-5 py-3 text-sm font-semibold bg-red-600 active:bg-red-800 text-white rounded-lg transition-colors cursor-pointer"
            >
              ■ Stop
            </button>
          )}

          {lastRefresh && (
            <span className="text-xs text-gray-400">
              {lastRefresh.toLocaleTimeString()} · 5s refresh
            </span>
          )}
        </div>
      </div>


      {/* Debug log — always visible on mobile for troubleshooting */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {rateLimited && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 px-4 py-2 rounded text-sm">
          OpenSky API rate limit reached — showing last known data. Resets after ~60 seconds or at midnight UTC.
        </div>
      )}

      {!active && flights.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">✈</div>
          <p className="text-lg font-medium">Set your location and start scanning</p>
          <p className="text-sm mt-1">
            Shows low-flying planes that will pass close to you — ideal for photography
          </p>
          <div className="mt-6 flex justify-center gap-6 text-xs">
            <span className="flex items-center gap-1.5">
              <span style={{ color: '#ef4444', fontSize: 18 }}>✈</span> &lt; 500 m alt
            </span>
            <span className="flex items-center gap-1.5">
              <span style={{ color: '#f97316', fontSize: 18 }}>✈</span> 500–1 500 m
            </span>
            <span className="flex items-center gap-1.5">
              <span style={{ color: '#eab308', fontSize: 18 }}>✈</span> 1 500–3 000 m
            </span>
            <span className="flex items-center gap-1.5">
              <span style={{ color: '#84cc16', fontSize: 18 }}>✈</span> ★ good shot
            </span>
            <span className="flex items-center gap-1.5">
              <span style={{ color: '#94a3b8', fontSize: 18 }}>✈</span> high / passing far
            </span>
          </div>
        </div>
      )}

      {(active || flights.length > 0) && (
        <>
          {/* Stats bar */}
          <div className="flex flex-wrap gap-3 items-center">
            {relevantCount > 0 && (
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                {relevantCount} good shot{relevantCount !== 1 ? 's' : ''} incoming
              </span>
            )}
            {flights.length > 0 && relevantCount === 0 && (
              <span className="text-sm text-gray-500">{flights.length} planes in range — none passing close enough yet</span>
            )}
          </div>

          {/* Map full-width on top, table below on small screens; side by side on large */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 h-[520px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
              <FlightMap
                center={userLocation ?? [50.08, 14.44]}
                userLocation={userLocation}
                flights={flights}
                airports={[]}
                showAirports={false}
                highlightIcao={highlightIcao}
                onHover={setHighlightIcao}
              />
            </div>
            <div className="lg:col-span-2 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 flex flex-col">
              <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                <span className="text-sm font-semibold">
                  {flights.length} planes
                  {active && (
                    <span className="ml-2 inline-block w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  )}
                </span>
                {loading && (
                  <span className="text-xs text-blue-500 animate-pulse">Refreshing…</span>
                )}
              </div>
              <div className="overflow-auto flex-1">
                <FlightTable
                  flights={flights}
                  highlightIcao={highlightIcao}
                  onHover={setHighlightIcao}
                  onSelect={(f) => setSelectedFlight((prev) => prev?.icao24 === f.icao24 ? null : f)}
                  selectedIcao={selectedFlight?.icao24 ?? null}
                />
              </div>
            </div>
          </div>

          {/* Detail panel */}
          {selectedFlight && (
            <div className="rounded-xl border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-900 shadow-md p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-base font-mono">
                  {selectedFlight.callsign ?? selectedFlight.icao24}
                  {selectedFlight.isRelevant && (
                    <span className="ml-2 text-xs text-emerald-500 font-semibold">★ OVERHEAD PASS</span>
                  )}
                </h2>
                <button
                  onClick={() => setSelectedFlight(null)}
                  className="flex items-center justify-center w-10 h-10 text-gray-400 active:text-gray-800 dark:active:text-white text-xl rounded-lg cursor-pointer"
                  aria-label="Close"
                >✕</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-2 text-sm">
                <Field label="ICAO24" value={selectedFlight.icao24} />
                <Field label="Callsign" value={selectedFlight.callsign ?? '—'} />
                <Field label="Country" value={selectedFlight.originCountry} />
                <Field label="Squawk" value={selectedFlight.squawk ?? '—'} />
                <Field
                  label="Altitude"
                  value={selectedFlight.baroAltitude !== null ? `${Math.round(selectedFlight.baroAltitude).toLocaleString()} m` : '—'}
                />
                <Field
                  label="V/S"
                  value={selectedFlight.verticalRate !== null
                    ? `${selectedFlight.verticalRate > 0 ? '▲' : '▼'} ${Math.abs(Math.round(selectedFlight.verticalRate * 60))} m/min`
                    : '—'}
                />
                <Field
                  label="Speed"
                  value={selectedFlight.velocity !== null ? `${Math.round(selectedFlight.velocity * 3.6)} km/h` : '—'}
                />
                <Field
                  label="Heading"
                  value={selectedFlight.trueTrack !== null ? `${Math.round(selectedFlight.trueTrack)}°` : '—'}
                />
                <Field
                  label="Position"
                  value={selectedFlight.latitude !== null && selectedFlight.longitude !== null
                    ? `${selectedFlight.latitude.toFixed(4)}, ${selectedFlight.longitude.toFixed(4)}`
                    : '—'}
                />
                <Field
                  label="Dist now"
                  value={selectedFlight.distanceFromUserKm < 1
                    ? `${Math.round(selectedFlight.distanceFromUserKm * 1000)} m`
                    : `${Math.round(selectedFlight.distanceFromUserKm)} km`}
                />
                <Field
                  label="Closest pass"
                  value={selectedFlight.closestApproachKm !== null
                    ? (selectedFlight.closestApproachKm < 1
                      ? `${Math.round(selectedFlight.closestApproachKm * 1000)} m`
                      : `${Math.round(selectedFlight.closestApproachKm)} km`)
                    : '—'}
                />
                <Field
                  label="ETA overhead"
                  value={selectedFlight.minutesUntilClosest !== null
                    ? (Math.abs(selectedFlight.minutesUntilClosest) < 0.5
                      ? 'NOW'
                      : selectedFlight.minutesUntilClosest < 0
                      ? `${Math.abs(Math.round(selectedFlight.minutesUntilClosest))} min ago`
                      : `in ~${Math.round(selectedFlight.minutesUntilClosest)} min`)
                    : '—'}
                />
                <Field label="Size class" value={
                  selectedFlight.aircraftSize === 'heavy' ? 'Wide-body (BIG)' :
                  selectedFlight.aircraftSize === 'large' ? 'Narrow-body (BIG)' :
                  selectedFlight.aircraftSize === 'medium' ? 'Regional (medium)' :
                  selectedFlight.aircraftSize === 'small' ? 'Light (small)' :
                  selectedFlight.aircraftSize === 'rotorcraft' ? 'Helicopter' :
                  selectedFlight.aircraftSize === 'special' ? 'Special' : '—'
                } />
                <Field label="Type" value={selectedFlight.typecode ?? '—'} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
