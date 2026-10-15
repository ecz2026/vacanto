import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: 'Vacanto – Last-Minute-Termine',
  description: 'Freie Termine bei Friseuren, Barbieren und mehr, last minute mit Rabatt.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <Header />
        {children}
        <footer style={{ maxWidth: 720, margin: '48px auto 24px', padding: '0 20px', fontSize: 14, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz</Link>
          <Link href="/agb">AGB</Link>
        </footer>
      </body>
    </html>
  );
}
