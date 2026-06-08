import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <div className="text-6xl mb-4">&#128247;</div>
      <h1 className="text-3xl font-extrabold text-gray-900 mb-3">Not Found</h1>
      <p className="text-gray-500 mb-8">
        The athlete or page you&apos;re looking for doesn&apos;t exist, or the link may have expired.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
      >
        &larr; Back to Search
      </Link>
    </div>
  )
}
