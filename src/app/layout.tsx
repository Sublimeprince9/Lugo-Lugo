import './globals.css';
import type { Metadata } from 'next';
import { VisitorSessionProvider } from '@/components/auth/VisitorSessionProvider';

export const metadata: Metadata = {
  title: 'Lugo-Lugo',
  description: 'QR-driven event map for UMA Showgrounds.',
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <VisitorSessionProvider>{children}</VisitorSessionProvider>
      </body>
    </html>
  );
}
