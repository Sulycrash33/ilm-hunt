import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, Source_Serif_4 } from "next/font/google"
import { ThemeProvider } from "@/components/ui/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { LanguageProvider } from "@/contexts/LanguageContext"
import { TapCue } from "@/components/layout/TapCue"
import { GameExperienceProvider } from "@/contexts/GameExperienceContext"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-inter",
})

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-source-serif",
})

export const viewport: Viewport = {
  themeColor: "#0b1326",
  width: "device-width",
  initialScale: 1,
  // Lets the page paint into the notch and home-indicator areas, which is what
  // makes env(safe-area-inset-*) non-zero. The layout then pads itself back
  // out per device rather than guessing a fixed number.
  viewportFit: "cover",
  // Deliberately no maximumScale or userScalable: blocking pinch zoom is an
  // accessibility failure, and this app is used by children and elders.
}

export const metadata: Metadata = {
  metadataBase: new URL("https://ilmhunt.app"),
  /**
   * Icons.
   *
   * The tab icon was still the Next.js starter favicon shipped with the
   * scaffold, so the browser showed the old mark long after the logo was
   * redrawn. All of these now render the crescent-and-star glyph — the same
   * one as `IlmHuntGlyph`, which exists precisely because the full mihrab mark
   * turns to mush below about 32px.
   *
   * Next resolves `src/app/icon.svg`, `apple-icon.png` and `favicon.ico` by
   * filename, but they are declared here as well so the order is explicit:
   * the SVG is preferred where supported and scales to any size, with the .ico
   * as the fallback for browsers that request /favicon.ico directly and ignore
   * the link tags.
   *
   * The Apple touch icon is deliberately square-cornered. iOS applies its own
   * rounded mask, so a pre-rounded image gets its corners clipped twice.
   */
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
  title: "ILM Hunt - Premium Islamic Learning",
  description:
    "Embark on a premium journey through Islamic knowledge with gamified learning, achievements, and a beautiful experience.",
  keywords:
    "Islamic education, Quran, Hadith, Islamic quiz, Islamic learning, ILM Hunt, premium Islamic app",
  openGraph: {
    title: "ILM Hunt - Premium Islamic Learning",
    description:
      "Premium gamified Islamic education platform for learning Quran, Hadith, and more.",
    url: "https://ilmhunt.app",
    siteName: "ILM Hunt",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ILM Hunt - Premium Islamic Learning",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ILM Hunt - Premium Islamic Learning",
    description:
      "Premium gamified Islamic education platform for learning Quran, Hadith, and more.",
    images: ["/og-image.png"],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${inter.variable} ${sourceSerif.variable} dark`}
      suppressHydrationWarning
    >
      <body className="min-h-[100dvh] font-body-md antialiased bg-background text-on-background">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <LanguageProvider>
            {/* The tap cue, once for the whole app. In the root layout rather
                than the (app) layout so onboarding, the language screen and
                the sound setup screen are audible too — the sound screen in
                particular, where a player is choosing a volume and every
                press should confirm the choice. */}
            <GameExperienceProvider>
            <TapCue />
            {children}
            <Toaster />
            </GameExperienceProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
