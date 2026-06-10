export const metadata = {
  title: 'Privacy Policy — FinishPics',
}

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-8">Effective June 10, 2026</p>

      <div className="prose prose-sm text-gray-700 space-y-6">

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">Who we are</h2>
          <p>
            FinishPics is a service operated by In Stride Timing. We provide photo-finish images
            from track and field events for purchase and download at{' '}
            <a href="https://www.finishpics.com" className="text-blue-600 hover:underline">
              finishpics.com
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">What information we collect</h2>
          <p>When you make a purchase, we collect:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Your email address (entered during checkout)</li>
            <li>Your purchase details (tier purchased, amount, date)</li>
            <li>A record linking your purchase to the athlete photo you bought</li>
          </ul>
          <p className="mt-2">
            We do <strong>not</strong> collect or store your credit card number, billing address,
            or any other payment details. All payment processing is handled by Stripe.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">How we use your information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To send your download links by email after purchase</li>
            <li>To verify your purchase when you return to download your files</li>
            <li>To respond to support requests you send us</li>
          </ul>
          <p className="mt-2">
            We do not use your information for marketing, and we do not sell or share your
            personal information with third parties.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">Third-party services</h2>
          <p>We use the following third-party services to operate FinishPics:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              <strong>Stripe</strong> — payment processing. Your payment information is handled
              directly by Stripe and subject to their{' '}
              <a href="https://stripe.com/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                privacy policy
              </a>.
            </li>
            <li>
              <strong>Resend</strong> — transactional email delivery (your purchase confirmation).
            </li>
            <li>
              <strong>Vercel</strong> — website hosting and infrastructure.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">Data retention</h2>
          <p>
            Purchase records are retained so that your download links continue to work. We do not
            automatically delete purchase records or download access.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-2">Contact</h2>
          <p>
            Questions about this policy? Email us at{' '}
            <a href="mailto:support@finishpics.com" className="text-blue-600 hover:underline">
              support@finishpics.com
            </a>.
          </p>
        </section>

      </div>
    </div>
  )
}
