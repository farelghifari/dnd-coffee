import type { Metadata } from 'next'
import { Geist, Geist_Mono, Kalam, Caveat } from 'next/font/google'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import { StoreProvider } from '@/lib/store'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

const _geist = Geist({ subsets: ["latin"], variable: '--font-geist' });
const _geistMono = Geist_Mono({ subsets: ["latin"], variable: '--font-geist-mono' });
const kalam = Kalam({ weight: ['300', '400', '700'], subsets: ["latin"], variable: '--font-kalam' });
const caveat = Caveat({ subsets: ["latin"], variable: '--font-caveat' });
const bryndanWrite = localFont({
  src: './fonts/BryndanWriteBook-nGPM.ttf',
  variable: '--font-bryndan',
});

export const metadata: Metadata = {
  title: 'DONOTDISTURB | Specialty Coffee & Creative Space',
  description: 'Where every cup tells a story. Single-origin beans, crafted with intention, served in a space designed for focus and creativity.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${_geist.variable} ${_geistMono.variable} ${kalam.variable} ${caveat.variable} ${bryndanWrite.variable} font-sans antialiased`}>
        <StoreProvider>
          {children}
        </StoreProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
