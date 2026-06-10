export const metadata = {
  title: 'Terms of Service — FinishPics',
}

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-400 mb-8">Effective June 10, 2026</p>

      <div className="prose prose-sm text-gray-700 space-y-6">

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">The service</h2>
          <p>
            FinishPics is operated by FinishPics. We provide photo-finish images captured
            at track and field events, available for purchase and digital download. By purchasing
            from FinishPics you agree to these terms.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">Purchases and refunds</h2>
          <p>
            All sales are final. Because our products are digital downloads delivered immediately
            upon purchase, we do not offer refunds. If you experience a technical problem with
            your download, contact us at{' '}
            <a href="mailto:support@finishpics.com" className="text-blue-600 hover:underline">
              support@finishpics.com
            </a>{' '}
            and we will make it right.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">License and permitted use</h2>
          <p>
            When you purchase a photo, you receive a personal, non-exclusive license to use it
            for personal purposes — sharing on social media, printing for personal use, keeping
            as a memento, and similar personal uses.
          </p>
          <p className="mt-2">You may not:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Resell or sublicense the images</li>
            <li>Use the images for commercial purposes without written permission</li>
            <li>Remove or alter any copyright or attribution information</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">Copyright</h2>
          <p>
            All images are the property of FinishPics. Purchase grants you a license
            to use the image as described above — it does not transfer ownership or copyright.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">Download links</h2>
          <p>
            Your download links do not expire and will remain accessible. We recommend saving
            your purchase confirmation email as a permanent record. FinishPics reserves
            the right to discontinue the service with reasonable advance notice, at which point
            we will make reasonable efforts to notify purchasers.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">Official results</h2>
          <p>
            Finish times and race information shown on FinishPics are provided for reference
            only and do not constitute official results. Official results are determined by meet
            officials and directors.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">Contact</h2>
          <p>
            Questions about these terms? Email us at{' '}
            <a href="mailto:support@finishpics.com" className="text-blue-600 hover:underline">
              support@finishpics.com
            </a>.
          </p>
        </section>

      </div>
    </div>
  )
}
