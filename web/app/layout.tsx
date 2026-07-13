import type { Metadata } from 'next'
import './globals.css'
import { CartProvider } from './components/CartContext'
import Header from './components/Header'

export const metadata: Metadata = {
  title: 'FinishPics — Own Your Finish Line',
  description:
    'Official photo-finish images from track & field meets. Find your race, style a share-ready graphic, and own your finish line.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-white text-fp-ink antialiased min-h-screen flex flex-col font-sans">
        <CartProvider>
          <Header />

          <main className="flex-1">
            {children}
          </main>

          {/* Footer */}
          <footer className="bg-fp-navy text-white/60 mt-16">
            <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-sm">
              <p className="fp-eyebrow text-[10px] text-fp-gold/80 mb-2">
                Official Photo-Finish Images
              </p>
              <p>
                &copy; {new Date().getFullYear()} FinishPics
              </p>
              <p className="mt-1">
                Questions?{' '}
                <a href="mailto:support@finishpics.com" className="text-white/85 hover:text-fp-gold transition-colors">
                  support@finishpics.com
                </a>
              </p>
              <p className="mt-1 space-x-3">
                <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
                <span>&middot;</span>
                <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
              </p>
            </div>
          </footer>
        </CartProvider>
      </body>
    </html>
  )
}
