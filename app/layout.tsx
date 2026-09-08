import React from "react"
import type { Metadata } from 'next'
import { Orbitron, Rajdhani } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from "@/components/session-provider"
import './globals.css'

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
      <body className={` ${orbitronFont.variable} 
        ${rajdhaniFont.variable} 
        antialiased text-pearl-white
      `}>
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
