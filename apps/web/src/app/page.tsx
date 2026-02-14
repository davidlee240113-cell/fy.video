import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-20 pt-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight text-slate-900 sm:text-7xl">
            Every video becomes a{' '}
            <span className="bg-gradient-to-r from-brand-600 to-accent-500 bg-clip-text text-transparent">
              self-contained economic unit
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            Package any video with pricing, affiliate rails, access controls, and analytics that
            travel with the content — regardless of where it is distributed.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/auth/register?role=creator" className="btn-primary px-8 py-3 text-base">
              Start Creating
            </Link>
            <Link href="/series" className="btn-secondary px-8 py-3 text-base">
              Browse Content
            </Link>
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="border-t border-slate-200 bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
                <svg className="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Package & Monetize</h3>
              <p className="mt-2 text-slate-600">
                Turn any video series into a paid product with per-episode pricing, bundles, and seamless Stripe checkout.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-50">
                <svg className="h-6 w-6 text-accent-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Distribute & Earn</h3>
              <p className="mt-2 text-slate-600">
                Every viewer becomes a distributor. Share a trackable affiliate link and earn commission on every sale.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
                <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Govern & Protect</h3>
              <p className="mt-2 text-slate-600">
                Enterprise-grade access controls, DRM, geo-restrictions, and audit trails for premium content.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold text-slate-900">How It Works</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {[
              { step: '1', title: 'Upload', desc: 'Upload your video series and set per-episode pricing' },
              { step: '2', title: 'Package', desc: 'Videos are packaged with paywall, analytics, and affiliate tracking' },
              { step: '3', title: 'Distribute', desc: 'Share links or let affiliates distribute for you' },
              { step: '4', title: 'Earn', desc: 'Revenue flows automatically to creators and affiliates' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
                  {item.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200 bg-brand-600 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-white">Ready to monetize your video content?</h2>
          <p className="mt-4 text-lg text-brand-100">
            Join creators who are turning their videos into revenue-generating assets.
          </p>
          <Link href="/auth/register?role=creator" className="mt-8 inline-block rounded-lg bg-white px-8 py-3 text-base font-semibold text-brand-600 shadow-sm hover:bg-brand-50">
            Create Your First Series
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-brand-600">
                <span className="text-xs font-bold text-white">fy</span>
              </div>
              <span className="text-sm text-slate-500">&copy; 2026 fy.video</span>
            </div>
            <div className="flex gap-6 text-sm text-slate-500">
              <a href="#" className="hover:text-slate-700">Terms</a>
              <a href="#" className="hover:text-slate-700">Privacy</a>
              <a href="#" className="hover:text-slate-700">API Docs</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
