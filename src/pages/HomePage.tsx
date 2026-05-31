import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@chakra-ui/react'
import { Header } from '../components'
import homeDashboardPreview from '../assets/images/home-dashboard-preview.png'

export function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [heroParallaxOffset, setHeroParallaxOffset] = useState(0)

  useEffect(() => {
    let ticking = false

    const updateParallax = () => {
      const nextOffset = Math.min(window.scrollY * 0.12, 54)
      setHeroParallaxOffset(nextOffset)
      ticking = false
    }

    const handleScroll = () => {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(updateParallax)
    }

    updateParallax()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const features = [
    {
      icon: '📅',
      title: 'Service Scheduling',
      description: 'Prepare each gathering with clarity so your team can focus less on scrambling and more on serving God with peace.',
    },
    {
      icon: '🎵',
      title: 'Song Library',
      description: 'Keep lyrics, arrangements, and setlists in one place so every rehearsal supports an offering that honors Jesus.',
    },
    {
      icon: '👥',
      title: 'Volunteer Coordination',
      description: 'Know who is serving, what is still uncovered, and where to care for the team before Sunday arrives.',
    },
  ]

  const plans = [
    {
      name: 'Starter',
      price: '$0',
      summary: 'For new church plants and lean teams.',
      perks: ['1 organization', 'Published service scheduling', 'Volunteer signups'],
    },
    {
      name: 'Team',
      price: '$29',
      summary: 'For growing worship teams that need structure.',
      perks: ['Unlimited services', 'Songbank workflows', 'Team management'],
      highlight: true,
    },
    {
      name: 'Scale',
      price: 'Custom',
      summary: 'For larger ministries and multi-campus operations.',
      perks: ['Custom onboarding', 'Priority support', 'Advanced rollout help'],
    },
  ]

  const faqs = [
    {
      question: 'How quickly can we start?',
      answer: 'Most teams can create their first organization, publish a service, and invite volunteers within the first 15 minutes.',
    },
    {
      question: 'Can volunteers use this on mobile?',
      answer: 'Yes. Published services and volunteer actions are designed to work well on mobile browsers, and the Android app can be used for a simplified serving flow.',
    },
    {
      question: 'Do we need to migrate everything at once?',
      answer: 'No. Many churches begin with upcoming services and volunteer assignments first, then move songs and historical plans over gradually.',
    },
    {
      question: 'Can admins keep control over who edits schedules?',
      answer: 'Yes. Role-based organization access lets owners and admins manage schedules while members and volunteers serve within their assigned scope.',
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main>
        <section className="relative overflow-hidden" id="hero">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-secondary-50" />
          <div className="absolute left-[-8%] top-14 h-56 w-56 rounded-full bg-primary-100/60 blur-3xl" />
          <div className="absolute bottom-0 right-[-6%] h-64 w-64 rounded-full bg-secondary-100/60 blur-3xl" />
          <div className="pointer-events-none absolute inset-y-0 left-0 hidden lg:block">
            <div
              className="absolute left-0 top-1/2 w-[74vw] max-w-[1120px] will-change-transform"
              style={{
                transform: `translate3d(0, calc(-50% + ${heroParallaxOffset}px), 0)`,
              }}
            >
              <div
                className="rounded-r-[36px] border border-white/70 bg-white/55 p-3 shadow-[0_30px_90px_rgba(15,23,42,0.10)] backdrop-blur-[2px]"
                style={{
                  WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0.98) 36%, rgba(0,0,0,0.78) 52%, rgba(0,0,0,0.34) 66%, rgba(0,0,0,0.08) 74%, rgba(0,0,0,0) 82%)',
                  maskImage: 'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0.98) 36%, rgba(0,0,0,0.78) 52%, rgba(0,0,0,0.34) 66%, rgba(0,0,0,0.08) 74%, rgba(0,0,0,0) 82%)',
                }}
              >
                <div className="rounded-r-[28px] border border-primary-200/70 bg-white/80 p-1.5 shadow-inner shadow-primary-950/10">
                  <img
                    alt="Spirit Lead dashboard preview"
                    className="w-full rounded-r-[22px] border border-primary-300/35 object-cover"
                    src={homeDashboardPreview}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center lg:gap-12 lg:px-8 lg:py-24">
            <div className="relative block lg:hidden">
              <div className="rounded-[30px] border border-white/80 bg-white/90 p-3 shadow-[0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur">
                <div className="mb-3 flex items-center justify-between rounded-[20px] border border-border bg-white px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-600">Inside Spirit Lead</p>
                    <p className="mt-1 text-sm text-text-muted">
                      See services, coverage, and songs in one calm planning view.
                    </p>
                  </div>
                </div>
                <div className="rounded-[24px] border border-primary-200/70 bg-white/80 p-1.5 shadow-inner shadow-primary-950/10">
                  <img
                    alt="Spirit Lead dashboard preview"
                    className="w-full rounded-[18px] border border-primary-300/35 object-cover"
                    src={homeDashboardPreview}
                  />
                </div>
              </div>
            </div>

            <div className="max-w-2xl lg:col-start-2 lg:pl-8">
              <h1 className="text-balance text-4xl font-extrabold tracking-tight text-text-primary sm:text-5xl lg:text-6xl">
                Prepare every service with peace and purpose.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-text-muted sm:text-xl">
                Keep schedules, songs, and volunteers aligned so your team can focus on worship instead of chasing details.
              </p>

              <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <Button as={Link} size="lg" to="/signup">
                  Start Free Trial
                </Button>
                <Button
                  as="a"
                  href="https://calendly.com/thejuan-codes/30min"
                  rel="noopener noreferrer"
                  size="lg"
                  target="_blank"
                  variant="outline"
                >
                  Schedule Demo
                </Button>
              </div>

              <p className="mt-5 text-sm text-text-muted">
                14-day free trial. No credit card required.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" id="features">
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-600">Core Workflow</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">A practical rhythm for serving with excellence and peace.</h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-text-muted">
              When schedules, songs, and volunteers stay aligned, your team can prepare prayerfully, communicate clearly, and give a more faithful offering to the Lord.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <div className="card-shadow card-hover rounded-2xl border border-border bg-white p-8" key={feature.title}>
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-2xl">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-text-primary">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-text-muted">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white py-16" id="pricing">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-600">Pricing</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">Simple plans for ministries that want to stay prepared.</h2>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {plans.map((plan) => (
                <div
                  className={`rounded-2xl border p-8 ${plan.highlight ? 'border-primary-200 bg-primary-50/40 shadow-card' : 'border-border bg-card shadow-soft'}`}
                  key={plan.name}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold text-text-primary">{plan.name}</h3>
                      <p className="mt-2 text-sm text-text-muted">{plan.summary}</p>
                    </div>
                    {plan.highlight ? <span className="badge-primary">Popular</span> : null}
                  </div>

                  <div className="mt-6 text-4xl font-bold tracking-tight text-text-primary">{plan.price}</div>
                  {plan.price !== 'Custom' ? <p className="mt-1 text-sm text-text-muted">per month</p> : null}

                  <ul className="mt-6 space-y-3 text-sm text-text-muted">
                    {plan.perks.map((perk) => (
                      <li className="flex items-start gap-3" key={perk}>
                        <span className="mt-1 h-2 w-2 rounded-full bg-primary-600" />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>

                  <Button as={Link} className="mt-8" size="lg" to="/signup" variant={plan.highlight ? 'solid' : 'outline'} width="full">
                    Get Started
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8" id="faq">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-600">FAQ</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">Questions ministry teams ask before switching.</h2>
          </div>

          <div className="mt-10 space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index

              return (
                <div className="rounded-2xl border border-border bg-white shadow-soft" key={faq.question}>
                  <button
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    type="button"
                  >
                    <span className="text-base font-semibold text-text-primary">{faq.question}</span>
                    <span className="text-xl text-text-muted">{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen ? (
                    <div className="border-t border-border px-6 py-5 text-sm leading-7 text-text-muted">
                      {faq.answer}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>

        <section className="pb-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-[28px] bg-gradient-to-r from-primary-600 to-secondary-600 px-8 py-12 text-center text-white shadow-card sm:px-12">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white/80">Next Step</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Lead the next service with more peace and less scramble.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-blue-50">
                Give your team a shared place to prepare faithfully, communicate clearly, and offer their best to Jesus week after week.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button as={Link} bg="white" color="blue.700" size="lg" to="/signup" _hover={{ bg: 'gray.100' }}>
                  Start Free Trial
                </Button>
                <Button
                  as={Link}
                  borderColor="whiteAlpha.600"
                  color="white"
                  fontWeight="600"
                  size="lg"
                  to="/about"
                  variant="outline"
                  bg="whiteAlpha.120"
                  _hover={{ bg: 'whiteAlpha.220', color: 'white' }}
                  _active={{ bg: 'whiteAlpha.260', color: 'white' }}
                >
                  Learn More
                </Button>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-border bg-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p>&copy; {new Date().getFullYear()} Spirit Lead. All rights reserved.</p>
            <div className="flex flex-wrap gap-4">
              <Link className="transition-colors hover:text-text-primary" to="/about">About</Link>
              <Link className="transition-colors hover:text-text-primary" to="/privacy">Privacy</Link>
              <Link className="transition-colors hover:text-text-primary" to="/terms">Terms</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
