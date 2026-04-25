'use client'

import type { FlightWithAirport, AircraftSize } from '@/lib/types'

interface Props {
  flights: FlightWithAirport[]
  highlightIcao?: string | null
  onHover?: (icao: string | null) => void
  onSelect?: (flight: FlightWithAirport) => void
  selectedIcao?: string | null
}

function altColor(altM: number | null): string {
  if (altM === null) return '#94a3b8'
  if (altM < 500) return '#ef4444'
  if (altM < 1500) return '#f97316'
  if (altM < 3000) return '#eab308'
  if (altM < 5000) return '#84cc16'
  return '#94a3b8'
}

function altLabel(m: number | null) {
  if (m === null) return '—'
  return `${Math.round(m).toLocaleString()} m`
}

function speedLabel(ms: number | null) {
  if (ms === null) return '—'
  return `${Math.round(ms * 3.6)} km/h`
}

function vRateLabel(ms: number | null) {
  if (ms === null) return null
  const mpm = Math.round(ms * 60)
  if (Math.abs(mpm) < 30) return null
  return { label: `${mpm > 0 ? '▲' : '▼'} ${Math.abs(mpm)} m/min`, descending: mpm < 0 }
}

function closestPassLabel(km: number | null, min: number | null): string {
  if (km === null) return '—'
  const distStr = km < 1 ? `${Math.round(km * 1000)} m` : `${Math.round(km)} km`
  if (min === null) return distStr
  if (min < -5) return `${distStr} (passed)`
  if (Math.abs(min) < 0.5) return `${distStr} NOW`
  if (min < 0) return `${distStr} (${Math.abs(Math.round(min))} min ago)`
  return `${distStr} in ~${Math.round(min)} min`
}

// Map size to a simple label for the overview table
const SIZE_LABEL: Record<AircraftSize, { text: string; cls: string }> = {
  heavy:      { text: 'BIG',    cls: 'text-amber-600 dark:text-amber-400 font-bold' },
  large:      { text: 'BIG',    cls: 'text-sky-600 dark:text-sky-400 font-bold' },
  medium:     { text: 'medium', cls: 'text-gray-500 dark:text-gray-400' },
  small:      { text: 'small',  cls: 'text-gray-400 dark:text-gray-500' },
  rotorcraft: { text: 'heli',   cls: 'text-purple-600 dark:text-purple-400' },
  special:    { text: 'other',  cls: 'text-gray-400' },
  unknown:    { text: '—',      cls: 'text-gray-400' },
}

function SizeCell({ size, typecode, modelName }: { size: AircraftSize; typecode?: string; modelName?: string }) {
  const d = SIZE_LABEL[size]
  const display = modelName ?? typecode
  return (
    <span className={d.cls}>
      {display
        ? <><span className="font-semibold text-gray-700 dark:text-gray-200">{display}</span> <span className="opacity-60 text-xs">{d.text}</span></>
        : d.text}
    </span>
  )
}

export default function FlightTable({ flights, highlightIcao, onHover, onSelect, selectedIcao }: Props) {
  if (flights.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-6 text-center">
        No flights found in this area.
      </div>
    )
  }

  return (
    <table className="w-full text-xs border-collapse">
      <thead className="sticky top-0 z-10">
        <tr className="bg-gray-100 dark:bg-gray-800 text-left">
          <th className="px-2 py-1.5 font-semibold">Callsign</th>
          <th className="px-2 py-1.5 font-semibold">Type</th>
          <th className="px-2 py-1.5 font-semibold">Altitude</th>
          <th className="px-2 py-1.5 font-semibold">V/S</th>
          <th className="px-2 py-1.5 font-semibold">Speed</th>
          <th className="px-2 py-1.5 font-semibold">Dist now</th>
          <th className="px-2 py-1.5 font-semibold">Closest pass</th>
        </tr>
      </thead>
      <tbody>
        {flights.map((f) => {
          const vr = vRateLabel(f.verticalRate)
          const color = altColor(f.baroAltitude)
          const isOverhead = f.distanceFromUserKm < 2
          const passingNow =
            f.minutesUntilClosest !== null && Math.abs(f.minutesUntilClosest) < 1
          const isBig = f.aircraftSize === 'heavy' || f.aircraftSize === 'large'

          return (
            <tr
              key={f.icao24}
              className={`border-t border-gray-200 dark:border-gray-700 cursor-pointer transition-colors ${
                selectedIcao === f.icao24
                  ? 'ring-2 ring-inset ring-blue-500 bg-blue-50 dark:bg-blue-900/40'
                  : highlightIcao === f.icao24
                  ? 'bg-blue-100 dark:bg-blue-900/50'
                  : passingNow || isOverhead
                  ? 'bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50'
                  : isBig && f.isRelevant
                  ? 'bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50'
                  : f.isRelevant
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              onMouseEnter={() => onHover?.(f.icao24)}
              onMouseLeave={() => onHover?.(null)}
              onClick={() => onSelect?.(f)}
            >
              <td className="px-2 py-1.5">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="font-mono font-bold" style={{ color }}>
                    {f.callsign ?? f.icao24}
                  </span>
                  {f.isDescending && (
                    <span className="text-orange-500 font-bold text-[10px]" title="Descending">↓</span>
                  )}
                  {(passingNow || isOverhead) && (
                    <span className="text-red-500 font-bold text-[10px] animate-pulse">●</span>
                  )}
                </div>
                <div className="text-gray-400 text-[10px]">{f.originCountry}</div>
              </td>
              <td className="px-2 py-1.5">
                <SizeCell size={f.aircraftSize} typecode={f.typecode} modelName={f.modelName} />
              </td>
              <td className="px-2 py-1.5">
                <span style={{ color }} className="font-semibold">{altLabel(f.baroAltitude)}</span>
              </td>
              <td className="px-2 py-1.5">
                {vr ? (
                  <span className={vr.descending ? 'text-orange-500' : 'text-blue-400'}>
                    {vr.label}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-2 py-1.5 text-gray-600 dark:text-gray-400">
                {speedLabel(f.velocity)}
              </td>
              <td className="px-2 py-1.5 text-gray-500">
                {f.distanceFromUserKm < 1
                  ? `${Math.round(f.distanceFromUserKm * 1000)} m`
                  : `${Math.round(f.distanceFromUserKm)} km`}
              </td>
              <td className={`px-2 py-1.5 font-semibold ${
                f.isRelevant
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}>
                {closestPassLabel(f.closestApproachKm, f.minutesUntilClosest)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
