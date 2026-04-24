'use client'

import { useEffect, useRef } from 'react'
import type { FlightWithAirport, NearbyAirport } from '@/lib/types'

interface Props {
  center: [number, number]
  userLocation: [number, number] | null
  flights: FlightWithAirport[]
  airports: NearbyAirport[]
  showAirports?: boolean
  highlightIcao?: string | null
  onHover?: (icao: string | null) => void
}

function altColor(altM: number | null, isRelevant: boolean): string {
  if (altM === null) return '#94a3b8'
  if (altM < 500) return '#ef4444'
  if (altM < 1500) return '#f97316'
  if (altM < 3000) return '#eab308'
  if (altM < 5000) return isRelevant ? '#84cc16' : '#94a3b8'
  return '#94a3b8'
}

function buildPlaneHtml(rotation: number, color: string, isHighlighted: boolean, isRelevant: boolean): string {
  const size = isHighlighted ? 28 : 22
  const shadow = isHighlighted
    ? `drop-shadow(0 0 6px ${color}) drop-shadow(0 0 3px rgba(0,0,0,0.8))`
    : 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))'
  const ring = isRelevant
    ? `<div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid ${color};opacity:0.6;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>`
    : ''
  // ✈ unicode points east by default; trueTrack is clockwise from north.
  // To point north at 0°: rotate by (trueTrack - 90) degrees.
  const cssRotation = rotation - 90
  return `<div style="position:relative;width:${size}px;height:${size}px;">
    ${ring}
    <div style="
      position:absolute;inset:0;
      display:flex;align-items:center;justify-content:center;
    ">
      <span style="
        display:inline-block;
        font-size:${size - 4}px;
        line-height:1;
        color:${color};
        filter:${shadow};
        transform:rotate(${cssRotation}deg);
        transform-origin:center center;
      ">✈</span>
    </div>
  </div>`
}

function buildUserMarkerHtml(): string {
  return `
    <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
      <div style="
        position:absolute;
        width:32px;height:32px;
        border-radius:50%;
        background:rgba(59,130,246,0.25);
        animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;
      "></div>
      <div style="
        position:relative;
        width:14px;height:14px;
        background:#3b82f6;
        border:2.5px solid #fff;
        border-radius:50%;
        box-shadow:0 0 0 3px rgba(59,130,246,0.5), 0 2px 8px rgba(0,0,0,0.7);
        z-index:1;
      "></div>
    </div>`
}

export default function FlightMap({
  center,
  userLocation,
  flights,
  airports,
  showAirports = true,
  highlightIcao,
  onHover,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flightMarkersRef = useRef<Map<string, any>>(new Map())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const airportMarkersRef = useRef<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMarkerRef = useRef<any>(null)

  // ── Init map + Leaflet once, then trigger dependent effects ──────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    import('leaflet').then((L) => {
      if (mapInstanceRef.current) return // already inited by a concurrent call
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      LRef.current = L

      const map = L.map(mapRef.current!, { zoomControl: true }).setView(center, 9)
      mapInstanceRef.current = map

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)

      // After map is ready, place user marker if we already have a location
      if (userLocation) {
        placeUserMarker(L, map, userLocation)
      }
    })
  // center intentionally omitted — only used for initial view
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── User location marker ─────────────────────────────────────────────────
  function placeUserMarker(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map: any,
    loc: [number, number]
  ) {
    if (userMarkerRef.current) {
      userMarkerRef.current.remove()
      userMarkerRef.current = null
    }

    const icon = L.divIcon({
      className: '',
      html: buildUserMarkerHtml(),
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    })

    userMarkerRef.current = L.marker(loc, { icon, zIndexOffset: 2000, interactive: false })
      .addTo(map)
      .bindTooltip('<strong>You are here</strong>', {
        permanent: false,
        direction: 'top',
        offset: [0, -16],
      })

    map.setView(loc, map.getZoom())
  }

  useEffect(() => {
    // If Leaflet + map are already ready, update immediately
    if (LRef.current && mapInstanceRef.current) {
      if (userLocation) {
        placeUserMarker(LRef.current, mapInstanceRef.current, userLocation)
      } else if (userMarkerRef.current) {
        userMarkerRef.current.remove()
        userMarkerRef.current = null
      }
    }
    // If map isn't ready yet, the init effect above will pick up userLocation from closure
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation])

  // ── Airport markers ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current || !LRef.current) return
    const L = LRef.current
    const map = mapInstanceRef.current

    airportMarkersRef.current.forEach((m) => m.remove())
    airportMarkersRef.current = []

    if (!showAirports) return

    const airportIcon = L.divIcon({
      className: '',
      html: `<div style="
        width:20px;height:20px;background:#f59e0b;border:2px solid #fff;
        border-radius:4px;display:flex;align-items:center;justify-content:center;
        font-size:10px;font-weight:bold;color:#fff;box-shadow:0 2px 4px rgba(0,0,0,0.4);
      ">✈</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    })

    airports.forEach((ap) => {
      const m = L.marker([ap.latitude, ap.longitude], { icon: airportIcon })
        .addTo(map)
        .bindTooltip(`<strong>${ap.icao}</strong><br/>${ap.name}<br/>${Math.round(ap.distanceKm)} km away`, {
          direction: 'top',
        })
      airportMarkersRef.current.push(m)
    })
  }, [airports, showAirports])

  // ── Flight markers — smooth update ──────────────────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current || !LRef.current) return
    const L = LRef.current
    const map = mapInstanceRef.current
    const existing = flightMarkersRef.current
    const currentIcaos = new Set(flights.map((f) => f.icao24))

    // Remove stale
    for (const [icao, marker] of existing) {
      if (!currentIcaos.has(icao)) {
        marker.remove()
        existing.delete(icao)
      }
    }

    flights.forEach((f) => {
      if (f.latitude === null || f.longitude === null) return

      const isHighlighted = highlightIcao === f.icao24
      const color = altColor(f.baroAltitude, f.isRelevant)
      const rotation = f.trueTrack ?? 0
      const html = buildPlaneHtml(rotation, color, isHighlighted, f.isRelevant)

      const icon = L.divIcon({
        className: '',
        html,
        iconSize: [isHighlighted ? 28 : 22, isHighlighted ? 28 : 22],
        iconAnchor: [isHighlighted ? 14 : 11, isHighlighted ? 14 : 11],
      })

      const altStr = f.baroAltitude !== null ? `${Math.round(f.baroAltitude)} m` : '—'
      const vRateStr = f.verticalRate !== null
        ? `${f.verticalRate > 0 ? '▲' : '▼'} ${Math.abs(Math.round(f.verticalRate * 60))} m/min`
        : ''
      const speedStr = f.velocity !== null ? `${Math.round(f.velocity * 3.6)} km/h` : '—'
      const distNow = f.distanceFromUserKm < 1
        ? `${Math.round(f.distanceFromUserKm * 1000)} m from you`
        : `${Math.round(f.distanceFromUserKm)} km from you`
      const closestStr = f.closestApproachKm !== null
        ? (() => {
            const d = f.closestApproachKm < 1
              ? `${Math.round(f.closestApproachKm * 1000)} m`
              : `${Math.round(f.closestApproachKm)} km`
            const t = f.minutesUntilClosest !== null
              ? (Math.abs(f.minutesUntilClosest) < 0.5
                ? ' — <span style="color:#ef4444;font-weight:bold">OVERHEAD NOW</span>'
                : f.minutesUntilClosest < 0
                ? ` — ${Math.abs(Math.round(f.minutesUntilClosest))} min ago`
                : ` — in ~${Math.round(f.minutesUntilClosest)} min`)
              : ''
            return `Closest: ${d}${t}`
          })()
        : ''
      const badge = f.isRelevant
        ? '<span style="color:#84cc16;font-weight:bold"> ★ OVERHEAD</span>'
        : ''

      const tooltipHtml = `
        <div style="font-family:monospace;font-size:12px;line-height:1.7">
          <strong style="font-size:14px">${f.callsign ?? f.icao24}</strong>${badge}<br/>
          ${f.originCountry}<br/>
          Alt: <strong>${altStr}</strong> ${vRateStr}<br/>
          Speed: ${speedStr}<br/>
          ${distNow}<br/>
          ${closestStr}
        </div>`

      if (existing.has(f.icao24)) {
        const marker = existing.get(f.icao24)
        marker.setLatLng([f.latitude, f.longitude])
        marker.setIcon(icon)
        marker.setTooltipContent(tooltipHtml)
      } else {
        const marker = L.marker([f.latitude, f.longitude], { icon })
          .addTo(map)
          .bindTooltip(tooltipHtml, { direction: 'top', offset: [0, -10] })
        marker.on('mouseover', () => onHover?.(f.icao24))
        marker.on('mouseout', () => onHover?.(null))
        existing.set(f.icao24, marker)
      }
    })
  }, [flights, highlightIcao, onHover])

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
      <div ref={mapRef} className="w-full h-full" />
    </>
  )
}
