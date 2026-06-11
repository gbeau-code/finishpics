import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getMeet } from '@/lib/database'
import MeetSearch from './MeetSearch'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ meetId: string }>
}

export default async function MeetPage({ params }: Props) {
  const { meetId } = await params
  const meet = await getMeet(meetId)
  if (!meet) notFound()

  const meetDate = new Date(meet.date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Back link */}
      <div className="mb-8">
        <Link href="/" className="text-sm text-blue-600 hover:text-blue-700 transition-colors">
          ← All meets
        </Link>
      </div>

      {/* Meet header */}
      <div className="text-center mb-10">
        <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-2">
          Photo-Finish Images
        </p>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">
          {meet.name}
        </h1>
        <p className="text-gray-500">
          {meetDate}{meet.location ? ` · ${meet.location}` : ''}
        </p>
      </div>

      <MeetSearch meetId={meet.id} />
    </div>
  )
}

export async function generateMetadata({ params }: Props) {
  const { meetId } = await params
  const meet = await getMeet(meetId)
  if (!meet) return { title: 'Meet Not Found — FinishPics' }
  return { title: `${meet.name} — FinishPics` }
}
