import './globals.css';

export const metadata = {
  title: 'PRISM — Evidence-led GTM',
  description: 'ICP discovery, red-teamed evidence, field validation and controlled learning',
};

export default function RootLayout({children}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
