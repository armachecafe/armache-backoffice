import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/auth-context';
import { PermissionsProvider } from '@/contexts/permissions-context';
import { BackofficeLayout } from '@/components/layout/backoffice-layout';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-display' });

export const metadata: Metadata = {
  title: 'Armache Café — Backoffice',
  description: 'Panel de administración y operaciones de Armache Café.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen">
        <AuthProvider>
          <PermissionsProvider>
            <BackofficeLayout>{children}</BackofficeLayout>
          </PermissionsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
