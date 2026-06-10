import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FinishPics — Your Photo-Finish Moment',
  description: 'Find and download your photo-finish timing images from track meets.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased min-h-screen flex flex-col">
        {/* Navigation */}
        <header className="border-b border-gray-100 bg-white sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-14">
              <a href="/" className="flex items-center gap-2 group">
                <span className="text-xl font-bold text-blue-600 tracking-tight group-hover:text-blue-700 transition-colors">
                  FinishPics
                </span>
                <span className="hidden sm:inline-block text-xs text-gray-400 font-medium mt-0.5">
                  Photo-Finish Images
                </span>
              </a>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-100 py-6 text-center text-sm text-gray-400">
          <p>
            &copy; {new Date().getFullYear()} FinishPics &mdash; Track &amp; Field Photo-Finish Images
          </p>
          <p className="mt-1">
            Questions?{' '}
            <a href="mailto:support@finishpics.com" className="text-blue-500 hover:text-blue-600 transition-colors">
              support@finishpics.com
            </a>
          </p>
          <p className="mt-1 space-x-3">
            <a href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
            <span>&middot;</span>
            <a href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</a>
          </p>
        </footer>
      </body>
    </html>
  )
}
