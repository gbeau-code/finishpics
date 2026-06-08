import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAthleteWithContext, effectiveStatus } from '@/lib/database'
import { formatRound, formatTime, formatPlace, formatEventLabel } from '@/lib/format'
import FrameGallery from './FrameGallery'

export const dynamic = 'force-dynamic'

interface Props {
  params: { athleteId: string }
}

export default async function PhotoPage({ params }: Props) {
  const athlete = await getAthleteWithContext(params.athleteId)
  if (!athlete) notFound()
  if (effectiveStatus(athlete!.heat) !== 'published') notFound()

  const { heat } = athlete
  const meet = heat.meet

  const eventLabel = formatEventLabel(heat.event_num, heat.round, heat.heat_num, heat.event_name)
  const roundLabel = formatRound(heat.round)

  const meetDate = new Date(meet.date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8 flex-wrap">
        <Link href="/" className="hover:text-blue-600 transition-colors">Home</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700 font-medium">{meet.name}</span>
        <span className="text-gray-300">/</span>
        <span>{eventLabel}</span>
      </nav>

      <div className="grid lg:grid-cols-5 gap-10">
        {/* Left: info + download */}
        <div className="lg:col-span-2 order-2 lg:order-1">
          <div className="bg-gray-50 rounded-2xl p-6 mb-6">
            <p className="text-sm font-medium text-gray-500 mb-0.5">{meet.name}</p>
            <p className="text-sm text-gray-400 mb-4">{meetDate}</p>

            <h1 className="text-2xl font-extrabold text-gray-900 mb-1">
              {athlete.first_name} {athlete.last_name}
            </h1>

            <div className="flex items-center gap-2 flex-wrap mb-4">
              {athlete.bib && athlete.bib !== '0' && (
                <span className="text-sm font-medium text-gray-600 bg-white border border-gray-200 px-2.5 py-0.5 rounded-lg">
                  Bib #{athlete.bib}
                </span>
              )}
              {athlete.team && <span className="text-sm text-gray-500">{athlete.team}</span>}
            </div>

            {athlete.place != null && (
              <div className="mb-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                  athlete.place === 1 ? 'bg-yellow-100 text-yellow-800'
                  : athlete.place === 2 ? 'bg-gray-100 text-gray-700'
                  : athlete.place === 3 ? 'bg-orange-100 text-orange-700'
                  : 'bg-gray-50 text-gray-500'
                }`}>
                  {formatPlace(athlete.place)} Place
                </span>
              </div>
            )}

            <div className="space-y-1.5 text-sm text-gray-600">
              <div className="flex justify-between">
                <span className="text-gray-400">Event</span>
                <span className="font-medium">{heat.event_name ?? `Event ${heat.event_num}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Round</span>
                <span className="font-medium">{roundLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Heat</span>
                <span className="font-medium">{heat.heat_num}</span>
              </div>
              {athlete.finish_time != null && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Finish Time</span>
                  <span className="font-mono font-semibold text-gray-800">{formatTime(athlete.finish_time)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Download */}
          <a
            href={`/api/download/${params.athleteId}`}
            className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors mb-2"
          >
            Download Formatted Image
          </a>
          <a
            href={`/api/download/${params.athleteId}/raw`}
            className="block w-full text-center bg-white hover:bg-gray-50 text-gray-600 font-medium py-2 px-6 rounded-xl border border-gray-200 transition-colors mb-3 text-sm"
          >
            Download Raw Photo
          </a>
          <p className="text-xs text-center text-gray-400">
            Local prototype — payment disabled
          </p>
        </div>

        {/* Right: watermarked preview + optional video */}
        <div className="lg:col-span-3 order-1 lg:order-2 space-y-5">
          <div>
            <div className="bg-gray-100 rounded-2xl overflow-hidden shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/preview/${params.athleteId}`}
                className="w-full"
                alt={`Photo-finish image for ${athlete.first_name} ${athlete.last_name}`}
              />
            </div>
            <p className="mt-2 text-xs text-center text-gray-400">
              Watermark removed on final download
            </p>
          </div>

          {athlete.frame_count != null && athlete.frame_count > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Finish-line camera &mdash; {athlete.frame_count} frames
              </p>
              <FrameGallery
                athleteId={params.athleteId}
                frameCount={athlete.frame_count}
                lastName={athlete.last_name}
              />
              <p className="mt-2 text-xs text-center text-gray-400">
                Click any frame to enlarge and download &mdash; captured by IdentiLynx
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: Props) {
  const athlete = await getAthleteWithContext(params.athleteId)
  if (!athlete || effectiveStatus(athlete.heat) !== 'published') {
    return { title: 'Athlete Not Found — FinishPics' }
  }
  return {
    title: `${athlete.first_name} ${athlete.last_name} — ${athlete.heat.meet.name} — FinishPics`,
  }
}
