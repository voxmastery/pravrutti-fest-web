import React from "react"
import type { Metadata } from 'next'
import { 
  Instrument_Sans, 
  Instrument_Serif, 
  JetBrains_Mono,
  Press_Start_2P,
  Orbitron,
  Rajdhani,
  VT323,
  Share_Tech_Mono
} from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from "@/components/session-provider"
import './globals.css'

const instrumentSans = Instrument_Sans({ 
  subsets: ["latin"],
  variable: '--font-instrument'
});

const instrumentSerif = Instrument_Serif({ 
  subsets: ["latin"],
  weight: "400",
  variable: '--font-instrument-serif'
});

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"],
  variable: '--font-jetbrains'
});

const arcadeFont = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: '--font-arcade'
});

const orbitronFont = Orbitron({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: '--font-orbitron'
});

const rajdhaniFont = Rajdhani({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: '--font-rajdhani'
});

const vt323Font = VT323({
  subsets: ["latin"],
  weight: "400",
  variable: '--font-vt323'
});

const shareTechMonoFont = Share_Tech_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: '--font-sharetech'
});

export const metadata: Metadata = {
  title: 'Pravrutti 2.0 - National Tech Fest RUAS',
  description: 'Experience innovation at the flagship national-level technical symposium of Ramaiah University of Applied Sciences.',
  generator: 'v0.app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        {/* The intro screen shows this immediately — preloading it means the
            wordmark is decoded before the overlay is even composited. */}
        <link rel="preload" as="image" href="/pravrutti-logo.png" fetchPriority="high" />
        <link rel="preload" as="image" href="/gate-temple.png" />
      </head>
      <body className={`
        ${instrumentSans.variable} 
        ${instrumentSerif.variable} 
        ${jetbrainsMono.variable} 
        ${arcadeFont.variable} 
        ${orbitronFont.variable} 
        ${rajdhaniFont.variable} 
        ${vt323Font.variable} 
        ${shareTechMonoFont.variable} 
        font-sans antialiased text-[#F7EEE4]
      `}>
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
