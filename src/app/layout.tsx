import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--ff-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--ff-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Reddit Outreach",
  description: "Find and reply to Reddit posts that match your brand.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
