'use client'

import { useState } from 'react'
import type { AppMode } from '@/lib/types'
import AirportFinderMode from '@/components/AirportFinderMode'
import SpotterMode from '@/components/SpotterMode'

export default function HomePage() {
  const [mode, setMode] = useState<AppMode>('finder')

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✈</span>
            <span className="font-bold text-lg tracking-tight">Sky Spotter</span>
            <span className="hidden sm:inline text-xs text-gray-400 ml-1">for plane spotters</span>
          </div>
          {/* Mode tabs */}
          <nav className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <button
              onClick={() => setMode('finder')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === 'finder'
                  ? 'bg-white dark:bg-gray-700 shadow text-blue-700 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Airport Finder
            </button>
            <button
              onClick={() => setMode('spotter')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === 'spotter'
                  ? 'bg-white dark:bg-gray-700 shadow text-blue-700 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Spotter View
            </button>
          </nav>
        </div>
      </header>

      {/* Mode description banner */}
      <div className="bg-blue-50 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900/50">
        <div className="max-w-7xl mx-auto px-4 py-2 text-xs text-blue-700 dark:text-blue-400">
          {mode === 'finder' ? (
            <>
              <strong>Airport Finder:</strong> Pick an area and see which airports have incoming flights right now. Great for deciding where to drive for the best spotting.
            </>
          ) : (
            <>
              <strong>Spotter View:</strong> You are at a location — see all planes flying nearby and when they are expected to pass. Auto-refreshes every 5 seconds.
            </>
          )}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {mode === 'finder' ? <AirportFinderMode /> : <SpotterMode />}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-3 text-center text-xs text-gray-400">
        Flight data via{' '}
        <a href="https://opensky-network.org" target="_blank" rel="noreferrer" className="underline hover:text-gray-600">
          OpenSky Network
        </a>{' '}
        · Map via{' '}
        <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer" className="underline hover:text-gray-600">
          OpenStreetMap
        </a>
      </footer>
    </div>
  )
}
