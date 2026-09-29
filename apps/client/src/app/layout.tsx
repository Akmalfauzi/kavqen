import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kavqen - Voice AI for Guided Forms',
  description: 'Build voice agents that guide conversations and turn spoken answers into structured form submissions.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-slate-50">{children}</body>
    </html>
  );
}
