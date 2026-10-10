import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'PricePilot — Supplier prices, under control',
  description: 'Turn supplier price lists into reviewed catalogue updates.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
