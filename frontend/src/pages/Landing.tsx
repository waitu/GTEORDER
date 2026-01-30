import { Footer } from '../components/Footer';
import { HeroSection } from '../components/HeroSection';
import { Navbar } from '../components/Navbar';

const trustBadges = [
  { icon: '🤝', title: '200+ sellers', subtitle: 'High-volume TikTok & ecom teams' },
  { icon: '🔗', title: 'Free API', subtitle: 'Connect your stack in hours' },
  { icon: '⚙️', title: '98% activation', subtitle: 'Same-day onboarding window' },
  { icon: '🛡️', title: 'US support', subtitle: 'Round-the-clock specialists' },
];

const quickSteps = [
  { title: 'Sign up / log in', description: 'Spin up access in 2 minutes and keep using same-day services.' },
  { title: 'Import tracking', description: 'Upload Excel/CSV tracking numbers (USPS only) or sync them via API/webhook.' },
  { title: 'Process & payout', description: 'Automated scans, fraud checks, and transparent payouts.' },
  { title: 'Track status', description: 'One console to check activation, disputes, and alerts.' },
];

const serviceCards = [
  {
    title: 'Design + Templates',
    description: 'Ready-to-launch creative assets optimized for conversions and compliance.',
    image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=60',
  },
  {
    title: 'Scan Label Automation',
    description: 'USPS-only validation and queue processing to keep your ops moving.',
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=60',
  },
  {
    title: 'Empty Package Ops',
    description: 'Bundle-optimized workflows for packaging, lot prep, and in-bulk scans.',
    image: 'https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=800&q=60',
  },
  {
    title: 'Buy Label Inventory',
    description: 'Bulk inventory pricing to speed up fulfillment while locking in costs.',
    image: 'https://images.unsplash.com/photo-1542838686-73e53785487b?auto=format&fit=crop&w=800&q=60',
  },
];

const pricingTiers = [
  { name: 'Standard', range: '< 10 labels/day', price: '$0.60', accent: 'from-sky-500 to-emerald-500' },
  { name: 'Metal', range: '10 - 30 labels/day', price: '$0.55', accent: 'from-sky-600 to-emerald-500' },
  { name: 'Silver', range: '30 - 100 labels/day', price: '$0.50', accent: 'from-sky-700 to-emerald-500' },
  { name: 'Gold', range: '100 - 300 labels/day', price: '$0.48', accent: 'from-sky-800 to-emerald-500' },
  { name: 'Diamond', range: '> 300 labels/day', price: '$0.45', accent: 'from-emerald-600 to-sky-600' },
];

const testimonials = [
  {
    name: 'Tia — Ops Lead',
    quote: 'Impressed by how quickly activation happens. Payments hit faster than any other partner we tried.',
  },
  {
    name: 'Davis — Fulfillment',
    quote: 'The API keeps our TikTok shop orders in sync. We can finally trust our label inventory counts.',
  },
  {
    name: 'Lara — Brand Owner',
    quote: 'Feels premium but easy. Support jumped on our questions instantly and shared best practices.',
  },
];

const blogPosts = [
  {
    title: 'Blueprint for repeatable label ops',
    excerpt: 'Architect a lean workflow for USPS-only operations with alerts and exception routing.',
    tag: 'Operations',
  },
  {
    title: 'How to forecast payouts confidently',
    excerpt: 'Simple models to predict fees, disputes, and refund timelines week over week.',
    tag: 'Finance',
  },
  {
    title: 'Securing scanners in the field',
    excerpt: 'Practical guardrails for endpoints, from trusted devices to adaptive OTP policies.',
    tag: 'Security',
  },
];

export const LandingPage = () => {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-white via-sky-50/40 to-emerald-50/30 text-slate-900">
      <Navbar />
      <main className="flex-1">
        <HeroSection />

        <section className="border-y border-slate-100 bg-white/80">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-12 md:grid-cols-4">
            {trustBadges.map((badge) => (
              <div key={badge.title} className="rounded-2xl border border-slate-100 bg-gradient-to-br from-sky-50 to-emerald-50/70 p-4">
                <div className="text-2xl">{badge.icon}</div>
                <p className="mt-3 text-lg font-semibold text-slate-900">{badge.title}</p>
                <p className="text-sm text-slate-500">{badge.subtitle}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-gradient-to-r from-slate-800 to-slate-900 py-8">
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
              <div className="flex items-center gap-3">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <span key={i} className="text-xl text-yellow-400">★</span>
            ))}
          </div>
          <span className="text-lg font-semibold text-white">4.9 / 5</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 backdrop-blur-sm">
          <p className="text-sm text-slate-300">
            Trusted by <span className="font-semibold text-white">200+ teams</span> across TikTok Shop & ecommerce
          </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-300">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400"></span>
          Verified reviews
              </div>
            </div>
          </div>
        </section>

        <section id="get-started" className="mx-auto max-w-6xl px-4 py-16">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Get started</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">Launch in four simple steps</h2>
            <p className="mt-2 text-slate-600">Move from signup to activated label scanning in a single afternoon.</p>
          </div>
          <div className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-6 sm:grid-cols-2">
              {quickSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-2xl border border-slate-100 bg-white/90 p-5 shadow-lg shadow-sky-100/60"
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-emerald-500 text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{step.description}</p>
                </div>
              ))}
            </div>
            <div className="rounded-3xl border border-slate-100 bg-gradient-to-br from-slate-900 to-slate-800 p-1 shadow-2xl">
              <div className="rounded-[22px] bg-slate-950/60 p-6 text-center text-slate-100">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Demo</p>
                <p className="mt-2 text-lg font-semibold">1. Create a new account</p>
                <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/70 p-6">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 text-2xl text-white">
                    ▶
                  </div>
                  <p className="mt-4 text-sm text-slate-400">Watch how teams import tracking, review payouts, and monitor status.</p>
                </div>
                <a
                  href="#pricing"
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-white/90 px-6 py-2 text-sm font-semibold text-slate-900"
                >
                  Start import tracking
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="services" className="bg-white/90 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Our services</p>
              <h2 className="mt-3 text-3xl font-bold text-slate-900">Everything you need to scale USPS labels</h2>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {serviceCards.map((card) => (
                <article key={card.title} className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl shadow-emerald-100/50">
                  <div
                    className="h-48 w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${card.image})` }}
                  />
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-slate-900">{card.title}</h3>
                    <p className="mt-3 text-sm text-slate-600">{card.description}</p>
                    <button className="mt-4 text-sm font-semibold text-sky-700 hover:text-emerald-600">Learn more →</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-4 py-16">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">Pricing</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">See how much you can make</h2>
            <p className="mt-2 text-slate-600">Unlock better deals as you grow. Prices shown per label scanned.</p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3 lg:grid-cols-5">
            {pricingTiers.map((tier) => (
              <div key={tier.name} className="rounded-2xl border border-slate-100 bg-white p-5 text-center shadow-md shadow-sky-100/60">
                <p className="text-sm font-semibold text-slate-500">{tier.range}</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">{tier.name}</h3>
                <div className={`mt-4 inline-flex rounded-full bg-gradient-to-r ${tier.accent} px-4 py-1 text-sm font-semibold text-white`}>
                  {tier.price} / label
                </div>
                <button className="mt-6 w-full rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 hover:border-emerald-300">Start import tracking</button>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-gradient-to-r from-sky-900 to-emerald-900 py-16 text-white">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.4em] text-white/60">Customer feedback</p>
              <h2 className="mt-3 text-3xl font-bold">Teams trust us to keep payouts flowing</h2>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {testimonials.map((testimonial) => (
                <figure key={testimonial.name} className="rounded-3xl border border-white/10 bg-white/10 p-6">
                  <blockquote className="text-sm leading-relaxed text-white/90">“{testimonial.quote}”</blockquote>
                  <figcaption className="mt-4 text-sm font-semibold">{testimonial.name}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="flex flex-col gap-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-600">Latest blog</p>
            <h2 className="text-3xl font-bold text-slate-900">Insights to keep your workflows sharp</h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {blogPosts.map((post) => (
              <article key={post.title} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-lg shadow-emerald-100/60">
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">{post.tag}</span>
                <h3 className="mt-3 text-xl font-semibold text-slate-900">{post.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{post.excerpt}</p>
                <button className="mt-4 text-sm font-semibold text-sky-700 hover:text-emerald-600">Read more →</button>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};
