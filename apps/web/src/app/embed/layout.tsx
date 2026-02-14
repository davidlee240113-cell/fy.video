import { Providers } from '../providers';

export const metadata = {
  title: 'fy.video Player',
};

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="m-0 min-h-screen bg-black p-0">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
