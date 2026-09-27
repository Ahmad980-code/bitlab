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
  authors: [{ name: "Ahmad Saleem", url: "https://github.com/Ahmad980-code" }],
  creator: "Ahmad Saleem",
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
        <footer className="space-y-1 border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
          <p>
            Made by{" "}
            <a href="https://github.com/Ahmad980-code" target="_blank" rel="noopener noreferrer" className="font-medium text-slate-300 hover:text-sky-400">
              Ahmad Saleem
            </a>{" "}
            ·{" "}
            <a href="https://github.com/Ahmad980-code/bitlab" target="_blank" rel="noopener noreferrer" className="hover:text-sky-400">
              Source on GitHub
            </a>
          </p>
          <p>© {new Date().getFullYear()} BitLab · built with Next.js, Supabase &amp; Vercel</p>
        </footer>
      </body>
    </html>
  );
}
