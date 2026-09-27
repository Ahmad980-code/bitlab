import Link from "next/link";

const TOOLS = [
  {
    href: "/logic",
    title: "Logic Circuit Simulator",
    tag: "Digital logic",
    body: "Drag AND, OR, XOR and NOT gates onto a board and wire them together. BitLab generates the truth table and Boolean expression live. Try building adders, multiplexers and latches.",
    accent: "from-emerald-400/20",
    icon: "⊕",
  },
  {
    href: "/bits",
    title: "Bit Lab",
    tag: "Number systems",
    body: "Convert between binary, hex, octal and decimal. See two's complement and IEEE-754 floats bit by bit, and try shifts, rotates and carry/overflow flags.",
    accent: "from-sky-400/20",
    icon: "0x",
  },
  {
    href: "/cpu",
    title: "8-bit CPU Emulator",
    tag: "Computer architecture",
    body: "Write assembly, assemble it to machine code, and step through the fetch-decode-execute cycle while you watch registers, flags, the stack and memory change.",
    accent: "from-amber-400/20",
    icon: "⚙",
  },
];

export default function Home() {
  return (
    <div className="space-y-14 py-6">
      <section className="space-y-5 text-center">
        <p className="font-mono text-xs tracking-[0.3em] text-sky-400 uppercase">
          01000010 01101001 01110100
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          See how computers work,
          <br />
          <span className="bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent">
            one bit at a time.
          </span>
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-slate-400">
          BitLab is an interactive playground for computer engineering, covering logic gates, number systems and a CPU you
          can program. Sign in to save your circuits and programs to the cloud and keep your files in one place.
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/logic" className="btn btn-primary px-5 py-2.5 text-base">
            Start building →
          </Link>
          <Link href="/cpu" className="btn px-5 py-2.5 text-base">
            Program the CPU
          </Link>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {TOOLS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`panel group relative overflow-hidden bg-gradient-to-b ${t.accent} to-transparent p-6 transition-transform hover:-translate-y-1 hover:border-slate-600`}
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 font-mono text-xl">
              {t.icon}
            </div>
            <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">{t.tag}</p>
            <h2 className="mt-1 text-xl font-semibold">{t.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">{t.body}</p>
            <p className="mt-5 text-sm text-sky-400 group-hover:underline">Open →</p>
          </Link>
        ))}
      </section>

      <section className="panel grid gap-6 p-6 md:grid-cols-4">
        <div className="md:col-span-1">
          <h2 className="text-lg font-semibold">☁ Cloud-powered</h2>
          <p className="mt-1 text-sm text-slate-400">Your work follows you across devices.</p>
        </div>
        {[
          ["Authentication", "Email and password accounts with Supabase Auth, using secure cookie sessions."],
          ["Cloud database", "Circuits and programs are saved to Postgres, and row-level security keeps each user's data private."],
          ["File storage", "Upload, download and manage files in your own private cloud storage folder."],
        ].map(([title, body]) => (
          <div key={title}>
            <h3 className="font-medium">{title}</h3>
            <p className="mt-1 text-sm text-slate-400">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
