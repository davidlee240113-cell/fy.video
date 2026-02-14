import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Navbar } from '@/components/layout/navbar';

export const metadata: Metadata = {
  title: 'fy.video — Video Packaging Platform',
  description: 'Turn any video into a trackable, monetizable, distributable affiliate object',
  openGraph: {
    title: 'fy.video',
    description: 'Turn any video into a trackable, monetizable, distributable affiliate object',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <Providers>
          <Navbar />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
