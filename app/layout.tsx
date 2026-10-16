import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zhala Studio · İçerik masan",
  description: "Markaların, içerik fikirlerin ve tasarım brieflerin için kişisel çalışma alanı.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
