"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions";

const LINKS = [
  { href: "/logic", label: "Logic Sim" },
  { href: "/bits", label: "Bit Lab" },
  { href: "/cpu", label: "CPU Emulator" },
];

export default function Nav({ cloudEnabled, email }: { cloudEnabled: boolean; email: string | null }) {
  const pathname = usePathname();
  const linkCls = (href: string) =>
    `rounded-md px-3 py-1.5 text-sm transition-colors ${
      pathname.startsWith(href) ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-100"
    }`;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3">
        <Link href="/" className="mr-4 flex items-center gap-2 font-mono text-lg font-bold">
          <span className="rounded bg-sky-500 px-1.5 text-slate-950">01</span>
          BitLab
        </Link>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={linkCls(l.href)}>
            {l.label}
          </Link>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {cloudEnabled &&
            (email ? (
              <>
                <Link href="/dashboard" className={linkCls("/dashboard")}>
                  ☁ My Cloud
                </Link>
                <span className="hidden text-xs text-slate-500 md:inline">{email}</span>
                <form action={signOut}>
                  <button className="btn">Sign out</button>
                </form>
              </>
            ) : (
              <Link href="/login" className="btn btn-primary">
                Sign in
              </Link>
            ))}
        </div>
      </nav>
    </header>
  );
}
