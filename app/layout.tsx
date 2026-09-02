import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:3000'),
  title: 'Traceglass — Trajectory Reader',
  description: 'A private, local-first viewer for agent trajectory JSON files.',
  openGraph: {
    title: 'Traceglass — Trajectory Reader',
    description: 'A private, local-first viewer for agent trajectory JSON files.',
    images: [{ url: '/og.png', width: 1680, height: 941, alt: 'Traceglass trajectory reader' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Traceglass — Trajectory Reader',
    description: 'A private, local-first viewer for agent trajectory JSON files.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
