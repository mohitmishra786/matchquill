/**
 * MatchQuill Home Page
 * Landing page: 3D hero, real product positioning, and CTAs into the app.
 */

'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { CheckCircle2, FileText, Globe, ShieldCheck, Sparkles } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

// The 3D ribbon is homepage-only decoration — never SSR'd, never blocks
// first paint, and only loaded once the client has mounted.
const ThreeCanvas = dynamic(() => import('@/components/three/ThreeCanvas'), {
  ssr: false,
});

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Plain helper (not a hook) so it's safe to call from inside .map().
 * Reduced-motion state is read once at the top of the component and
 * threaded through.
 *
 * Opacity is intentionally never the gate for visibility here — content
 * stays at opacity: 1 in both the "hidden" and "visible" states, and only
 * a subtle translateY animates. That way, if the IntersectionObserver
 * behind whileInView never fires (headless renderers, prerendering,
 * backgrounded tabs, reduced-motion users), the section is still fully
 * visible and legible instead of shipping blank.
 */
function revealVariants(delay = 0, reduceMotion = false): Variants {
  if (reduceMotion) {
    return {
      hidden: { opacity: 1, y: 0 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    };
  }
  return {
    hidden: { opacity: 1, y: 28 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: EASE, delay },
    },
  };
}

const STATS = [
  {
    value: '13+',
    label: 'Job boards & ATS platforms',
    detail: 'LinkedIn, Indeed, Greenhouse, Lever, Workday, and more — read directly in your browser.',
  },
  {
    value: '4',
    label: 'Resume templates',
    detail: 'Professional, academic, developer, and technical layouts.',
  },
  {
    value: '0',
    label: 'Fabricated facts',
    detail: 'Generation is constrained to your validated profile — nothing invented on your behalf.',
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Build your profile',
    body: 'Add your experience, skills, projects, and education once — or upload an existing resume to start from.',
  },
  {
    step: '02',
    title: 'Browse jobs as usual',
    body: 'Install the MatchQuill extension. When you open a listing on LinkedIn, Indeed, Greenhouse, or another supported board, it reads the posting on the page — no copy-paste.',
  },
  {
    step: '03',
    title: 'Compile & apply',
    body: 'Generate a resume and cover letter built only from your own validated data, then download the PDF and apply.',
  },
];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'ATS-friendly by default',
    body: 'Clean, parseable formatting designed to pass Applicant Tracking Systems — no fancy layout tricks that get silently rejected.',
  },
  {
    icon: Globe,
    title: 'Local job extraction',
    body: 'The browser extension parses the job posting where you already are — LinkedIn, Indeed, Greenhouse, Lever, Workday, and more.',
  },
  {
    icon: CheckCircle2,
    title: 'Zero-hallucination tailoring',
    body: 'Every bullet is constrained to your validated profile. MatchQuill rewrites and reorders your real experience — it doesn’t invent new experience.',
  },
  {
    icon: FileText,
    title: 'Templates for the role',
    body: 'Professional, academic, developer, and technical templates, each tuned to how a given role is actually read.',
  },
];

export default function Home() {
  const { data: session, status } = useSession();
  const { theme } = useTheme();
  const isAuthenticated = status === 'authenticated' && !!session?.user;
  const isDark = theme === 'dark';
  const reduceMotion = Boolean(useReducedMotion());

  const heroReveal = revealVariants(0, reduceMotion);
  const heroReveal2 = revealVariants(0.12, reduceMotion);
  const heroReveal3 = revealVariants(0.24, reduceMotion);

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: 'var(--background)' }}>
      {/* 3D staircase / ribbon — fixed behind content, purely decorative.
          Still mounted; never removed. Visibility depends on a light scrim
          (not an opaque wall) so the helix remains visible around the hero. */}
      <ThreeCanvas isDark={isDark} reduceMotion={reduceMotion} />

      {/* Hero */}
      <section className="relative z-10 pt-28 pb-24 px-4 sm:pt-36 sm:pb-32">
        {/* Soft scrim for legibility — keep opacity moderate so the moving
            staircase is still visible at the sides and through the mask edge.
            (Earlier values ~0.95–0.98 made the ribbon look "removed".) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-[min(100%,48rem)] h-[34rem] -z-[1]"
          style={{
            background: 'var(--background)',
            opacity: isDark ? 0.55 : 0.62,
            WebkitMaskImage: 'radial-gradient(60% 55% at 50% 42%, black 45%, transparent 100%)',
            maskImage: 'radial-gradient(60% 55% at 50% 42%, black 45%, transparent 100%)',
          }}
        />
        <div className="max-w-3xl mx-auto text-center px-4">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={heroReveal}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium mb-6"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--foreground-secondary)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
            }}
          >
            <Sparkles size={14} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
            Local JD extraction &middot; Zero fabricated facts &middot; Your data only
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={heroReveal2}
            className="font-bold leading-[1.05] text-[clamp(2.25rem,6vw,4rem)] tracking-[-0.03em]"
            style={{ color: 'var(--foreground)', fontFamily: 'var(--font-display)', textWrap: 'balance' }}
          >
            Tailored resumes for{' '}
            <span style={{ color: 'var(--primary)' }}>every job</span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={heroReveal3}
            className="mt-6 text-lg sm:text-xl max-w-xl mx-auto"
            style={{ color: 'var(--foreground-secondary)', textWrap: 'pretty' }}
          >
            MatchQuill reads job postings where you already browse, matches them against a
            profile you control, and compiles a resume built only from things you&rsquo;ve
            actually done.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={heroReveal3}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10"
          >
            {status === 'loading' ? (
              <>
                <div className="w-full sm:w-56 h-[52px] rounded-full animate-pulse" style={{ background: 'var(--muted)' }} aria-hidden="true" />
                <div className="w-full sm:w-36 h-[52px] rounded-full animate-pulse" style={{ background: 'var(--muted)' }} aria-hidden="true" />
              </>
            ) : isAuthenticated ? (
              <>
                <Link
                  href="/dashboard"
                  className="group w-full sm:w-auto flex items-center justify-center gap-2 pl-8 pr-3 py-3.5 min-h-[44px] font-semibold rounded-full transition-all duration-300 active:scale-[0.98] text-lg"
                  style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  Go to Dashboard
                  <span
                    className="flex items-center justify-center w-9 h-9 rounded-full transition-transform duration-300 group-hover:translate-x-0.5"
                    style={{ background: 'rgba(255,255,255,0.2)' }}
                  >
                    &rarr;
                  </span>
                </Link>
                <Link
                  href="/profile"
                  className="w-full sm:w-auto px-8 py-3.5 min-h-[44px] font-semibold rounded-full transition-all text-lg hover:opacity-80 border"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--card)' }}
                >
                  View Profile
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/register"
                  className="group w-full sm:w-auto flex items-center justify-center gap-2 pl-8 pr-3 py-3.5 min-h-[44px] font-semibold rounded-full transition-all duration-300 active:scale-[0.98] text-lg"
                  style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  Create Free Account
                  <span
                    className="flex items-center justify-center w-9 h-9 rounded-full transition-transform duration-300 group-hover:translate-x-0.5"
                    style={{ background: 'rgba(255,255,255,0.2)' }}
                  >
                    &rarr;
                  </span>
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-8 py-3.5 min-h-[44px] font-semibold rounded-full transition-all text-lg hover:opacity-80 border"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--card)' }}
                >
                  Sign In
                </Link>
              </>
            )}
          </motion.div>
        </div>

        {/* Stats row */}
        <div className="relative z-10 max-w-5xl mx-auto mt-20 grid grid-cols-1 sm:grid-cols-3 gap-4 px-4">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={revealVariants(i * 0.08, reduceMotion)}
              className="rounded-[1.75rem] p-1.5"
              style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(var(--glass-blur))', WebkitBackdropFilter: 'blur(var(--glass-blur))' }}
            >
              <div
                className="rounded-[calc(1.75rem-0.375rem)] p-6 h-full"
                style={{ background: 'var(--card)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.08)' }}
              >
                <div
                  className="text-4xl font-bold tracking-tight"
                  style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}
                >
                  {stat.value}
                </div>
                <div className="mt-2 font-semibold" style={{ color: 'var(--foreground)' }}>
                  {stat.label}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                  {stat.detail}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="relative z-10 py-24 px-4 sm:py-32" style={{ background: 'var(--muted)' }}>
        <div className="max-w-5xl mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={revealVariants(0, reduceMotion)}
            className="text-center mb-16"
          >
            <h2
              className="text-3xl md:text-4xl font-bold tracking-[-0.02em]"
              style={{ color: 'var(--foreground)', fontFamily: 'var(--font-display)', textWrap: 'balance' }}
            >
              How it works
            </h2>
            <p className="mt-4 text-lg" style={{ color: 'var(--muted-foreground)' }}>
              Three steps, start to finish.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {HOW_IT_WORKS.map((item, i) => (
              <motion.div
                key={item.step}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={revealVariants(i * 0.1, reduceMotion)}
                className="relative p-1.5 rounded-[2rem]"
                style={{ background: 'var(--card)' }}
              >
                <div
                  className="rounded-[calc(2rem-0.375rem)] p-7 h-full border"
                  style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                >
                  <div
                    className="inline-flex items-center justify-center w-11 h-11 rounded-2xl mb-5 text-sm font-bold"
                    style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', fontFamily: 'var(--font-mono)' }}
                  >
                    {item.step}
                  </div>
                  <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                    {item.title}
                  </h3>
                  <p style={{ color: 'var(--muted-foreground)' }}>{item.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="relative z-10 py-24 px-4 sm:py-32" style={{ background: 'var(--background)' }}>
        <div className="max-w-5xl mx-auto px-4">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={revealVariants(0, reduceMotion)}
            className="text-center mb-16"
          >
            <h2
              className="text-3xl md:text-4xl font-bold tracking-[-0.02em]"
              style={{ color: 'var(--foreground)', fontFamily: 'var(--font-display)', textWrap: 'balance' }}
            >
              Built on your real experience
            </h2>
            <p className="mt-4 text-lg max-w-2xl mx-auto" style={{ color: 'var(--muted-foreground)' }}>
              No invented job titles, no exaggerated scope — just your history, presented well.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-6 sm:gap-8">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-60px' }}
                  variants={revealVariants(i * 0.08, reduceMotion)}
                  className="p-1.5 rounded-[2rem]"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  <div className="rounded-[calc(2rem-0.375rem)] p-8 h-full">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                      style={{ background: 'var(--muted)' }}
                    >
                      <Icon size={22} strokeWidth={1.75} style={{ color: 'var(--primary)' }} />
                    </div>
                    <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                      {feature.title}
                    </h3>
                    <p style={{ color: 'var(--muted-foreground)' }}>{feature.body}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-24 px-4 sm:py-32" style={{ background: 'var(--muted)' }}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={revealVariants(0, reduceMotion)}
          className="max-w-3xl mx-auto text-center px-4"
        >
          <div
            className="rounded-[2.5rem] p-1.5"
            style={{ background: 'var(--primary)' }}
          >
            <div className="rounded-[calc(2.5rem-0.375rem)] p-12 sm:p-16" style={{ background: 'var(--primary)' }}>
              <h2
                className="text-3xl md:text-4xl font-bold tracking-[-0.02em]"
                style={{ color: 'var(--primary-foreground)', fontFamily: 'var(--font-display)', textWrap: 'balance' }}
              >
                Send a resume that&rsquo;s actually yours
              </h2>
              <p
                className="text-lg mt-4 mb-8 max-w-xl mx-auto"
                style={{ color: 'var(--primary-foreground)', opacity: 0.85 }}
              >
                Build your profile once. Tailor it for every application after that.
              </p>
              {status === 'loading' ? (
                <div className="inline-block w-48 h-[52px] rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.25)' }} aria-hidden="true" />
              ) : (
                <Link
                  href={isAuthenticated ? '/dashboard' : '/register'}
                  className="inline-flex items-center gap-2 px-8 py-3.5 min-h-[44px] font-semibold rounded-full transition-all text-lg hover:opacity-90 active:scale-[0.98]"
                  style={{ background: 'var(--card)', color: 'var(--primary)' }}
                >
                  {isAuthenticated ? 'Go to Dashboard' : 'Start Free Today'}
                </Link>
              )}
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
