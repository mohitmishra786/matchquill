import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/ThemeProvider";
import MobileNav from "@/components/ui/MobileNav";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "MatchQuill | Career Resume Compiler",
  description: "Generate tailored resumes and cover letters for job applications with AI assistance",
  keywords: ["resume", "cover letter", "job application", "career", "AI"],
  icons: {
    icon: [{ url: "/logo-mark.svg", type: "image/svg+xml" }],
    apple: [{ url: "/logo-mark.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${plusJakartaSans.variable} antialiased min-h-screen flex flex-col`}
        style={{ background: 'var(--background)', color: 'var(--foreground)' }}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400"
        >
          Skip to main content
        </a>
        <GlobalErrorBoundary>
          {/* Avoid refetch storms that slow protected navigations */}
          <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
            <ThemeProvider>
              <LanguageProvider>
                <ToastProvider>
                  <Navbar />
                  <main id="main-content" className="flex-1">
                    {children}
                  </main>
                  <Footer />
                  <MobileNav />
                </ToastProvider>
              </LanguageProvider>
            </ThemeProvider>
          </SessionProvider>
        </GlobalErrorBoundary>
        {/* Load Vercel Web Analytics only after it's enabled in the Vercel
            dashboard. Set NEXT_PUBLIC_ENABLE_ANALYTICS=true once enabled;
            otherwise the injected script 404s and errors in the console. */}
        {process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true' && <Analytics />}
      </body>
    </html>
  );
}
