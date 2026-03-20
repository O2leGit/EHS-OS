import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EHS-OS | Environmental Health & Safety",
  description: "AI-native Environmental Health & Safety Operating System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-navy-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
