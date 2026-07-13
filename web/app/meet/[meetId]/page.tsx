import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getMeet } from '@/lib/database'
import Banner from '@/app/components/ui/Banner'
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
    <div>
      <Banner
        eyebrow="Find my finish"
        title={meet.name}
        meta={<>{meetDate}{meet.location ? <> · {meet.location}</> : null}</>}
      >
        <Link
          href="/meets"
          className="text-sm font-bold text-white/75 hover:text-white transition-colors duration-fp-fast"
        >
          ← All meets
        </Link>
      </Banner>

      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-10 fp-page-in">
        <MeetSearch meetId={meet.id} />
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: Props) {
  const { meetId } = await params
  const meet = await getMeet(meetId)
  if (!meet) return { title: 'Meet Not Found — FinishPics' }
  return { title: `${meet.name} — FinishPics` }
}
