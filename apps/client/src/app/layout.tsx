import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KavQen - Voice Agent Form Filler',
  description: 'Real-time Voice AI agent powered by AssemblyAI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen antialiased bg-slate-50">{children}</body>
    </html>
  );
}
