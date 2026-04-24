'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { FlightWithAirport, NearbyAirport } from '@/lib/types'
import FlightTable from '@/components/FlightTable'

const FlightMap = dynamic(() => import('@/components/FlightMap'), { ssr: false })

interface ApiResponse {
  flights: FlightWithAirport[]
  airports: NearbyAirport[]
  error?: string
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
  const [highlightIcao, setHighlightIcao] = useState<string | null>(null)
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
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(5))
        setLon(pos.coords.longitude.toFixed(5))
        setLocating(false)
      },
      () => {
        setLocating(false)
        setError('Could not get your location. Please enter coordinates manually.')
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
      <div className="flex flex-wrap gap-3 items-end bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500">Latitude</label>
          <input
            type="number"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="e.g. 50.0880"
            className="w-32 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800"
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
            className="w-32 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800"
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
            className="w-24 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500">Max altitude (m)</label>
          <select
            value={maxAlt}
            onChange={(e) => setMaxAlt(e.target.value)}
            className="w-32 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800"
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
            className="w-28 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800"
          >
            <option value="0.5">0.5 km (direct overhead)</option>
            <option value="1">1 km</option>
            <option value="2">2 km</option>
            <option value="5">5 km</option>
            <option value="10">10 km</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500">Filter</label>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none h-[30px]">
            <input
              type="checkbox"
              checked={landingOnly}
              onChange={(e) => setLandingOnly(e.target.checked)}
              className="rounded"
            />
            Descending only
          </label>
        </div>

        <button
          onClick={handleLocate}
          disabled={locating}
          className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors disabled:opacity-50 self-end"
        >
          {locating ? 'Locating…' : '📍 My location'}
        </button>

        {!active ? (
          <button
            onClick={handleStart}
            className="px-4 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors self-end"
          >
            ▶ Start Scanning
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="px-4 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors self-end"
          >
            ■ Stop
          </button>
        )}

        {lastRefresh && (
          <span className="text-xs text-gray-400 self-end pb-1.5">
            {lastRefresh.toLocaleTimeString()} · 5s refresh
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-2 rounded text-sm">
          {error}
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
                  mode="spotter"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
