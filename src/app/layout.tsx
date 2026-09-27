import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import { cloudEnabled } from "@/lib/supabase/config";
import { getUser } from "@/lib/supabase/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "BitLab: a Computer Engineering Playground",
    template: "%s · BitLab",
  },
  description:
    "Interactive logic circuit simulator, number systems lab and 8-bit CPU emulator, with your work saved to the cloud.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans text-slate-100">
        <Nav cloudEnabled={cloudEnabled} email={user?.email ?? null} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
          BitLab · built with Next.js, Supabase &amp; Vercel
        </footer>
      </body>
    </html>
  );
}
