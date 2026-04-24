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

export default function AirportFinderMode() {
  const [lat, setLat] = useState<string>('50.08')
  const [lon, setLon] = useState<string>('14.44')
  const [radius, setRadius] = useState<string>('200')
  const [flights, setFlights] = useState<FlightWithAirport[]>([])
  const [airports, setAirports] = useState<NearbyAirport[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [highlightIcao, setHighlightIcao] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [locating, setLocating] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    const parsedLat = parseFloat(lat)
    const parsedLon = parseFloat(lon)
    const parsedRadius = parseFloat(radius)
    if (isNaN(parsedLat) || isNaN(parsedLon) || isNaN(parsedRadius)) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/flights?lat=${parsedLat}&lon=${parsedLon}&radius=${parsedRadius}&mode=finder`
      )
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
  }, [lat, lon, radius])

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(fetchData, 5000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchData])

  const handleLocate = () => {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(4))
        setLon(pos.coords.longitude.toFixed(4))
        setLocating(false)
      },
      () => {
        setLocating(false)
        setError('Could not get your location.')
      }
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500">Center Latitude</label>
          <input
            type="number"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className="w-28 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800"
            step="0.01"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500">Center Longitude</label>
          <input
            type="number"
            value={lon}
            onChange={(e) => setLon(e.target.value)}
            className="w-28 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800"
            step="0.01"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500">Radius (km)</label>
          <input
            type="number"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            min="50"
            max="500"
            className="w-24 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800"
          />
        </div>
        <button
          onClick={handleLocate}
          disabled={locating}
          className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors disabled:opacity-50"
        >
          {locating ? 'Locating…' : '📍 Use my location'}
        </button>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Search'}
        </button>
        {lastRefresh && (
          <span className="text-xs text-gray-400 self-center">
            Updated {lastRefresh.toLocaleTimeString()} · auto-refresh 5s
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Nearby airports summary */}
      {airports.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {airports.map((ap) => (
            <span
              key={ap.icao}
              className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-700"
            >
              {ap.icao} – {ap.name} ({Math.round(ap.distanceKm)} km)
            </span>
          ))}
        </div>
      )}

      {/* Map + Table layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-[500px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
          {typeof window !== 'undefined' && (
            <FlightMap
              center={[parseFloat(lat) || 50.08, parseFloat(lon) || 14.44]}
              userLocation={null}
              flights={flights}
              airports={airports}
              highlightIcao={highlightIcao}
              onHover={setHighlightIcao}
            />
          )}
        </div>
        <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900">
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm font-semibold">
              {flights.length} flights in range
            </span>
            {loading && (
              <span className="text-xs text-blue-500 animate-pulse">Refreshing…</span>
            )}
          </div>
          <FlightTable
            flights={flights}
            highlightIcao={highlightIcao}
            onHover={setHighlightIcao}
            mode="finder"
          />
        </div>
      </div>
    </div>
  )
}
