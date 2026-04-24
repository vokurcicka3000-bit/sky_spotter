import SpotterMode from '@/components/SpotterMode'

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-2">
          <span className="text-2xl">✈</span>
          <span className="font-bold text-lg tracking-tight">Sky Spotter</span>
          <span className="hidden sm:inline text-xs text-gray-400 ml-1">for plane spotters</span>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <SpotterMode />
      </main>

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
