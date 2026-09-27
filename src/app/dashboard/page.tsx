import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { deleteProject } from "@/app/actions";
import FileManager from "@/components/FileManager";
import { cloudEnabled, type ProjectRow } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My Cloud" };

function ProjectList({ title, href, rows, empty }: { title: string; href: string; rows: ProjectRow[]; empty: string }) {
  return (
    <div className="panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <Link href={href} className="text-sm text-sky-400 hover:underline">
          + New
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-800">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <Link href={`${href}?project=${p.id}`} className="flex-1 truncate hover:text-sky-300">
                {p.name}
              </Link>
              <span className="text-xs text-slate-500">
                {new Date(p.updated_at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}
              </span>
              <form action={deleteProject}>
                <input type="hidden" name="id" value={p.id} />
                <button className="text-xs text-slate-500 hover:text-rose-400" aria-label={`Delete ${p.name}`}>
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function Page() {
  if (!cloudEnabled) redirect("/login");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/dashboard");

  const { data, error } = await supabase
    .from("projects")
    .select("id, kind, name, updated_at")
    .order("updated_at", { ascending: false });
  const rows = (data ?? []) as ProjectRow[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">My Cloud</h1>
        <p className="text-sm text-slate-400">Everything you&apos;ve saved, stored in Supabase and available on any device.</p>
      </header>
      {error && (
        <p className="panel border-rose-900 p-4 text-sm text-rose-300">
          Couldn&apos;t load projects: {error.message}. Did you run <code>supabase/schema.sql</code>?
        </p>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        <ProjectList
          title="⊕ Circuits"
          href="/logic"
          rows={rows.filter((r) => r.kind === "circuit")}
          empty="No circuits yet. Build one in the Logic Simulator and click Save to cloud."
        />
        <ProjectList
          title="⚙ Programs"
          href="/cpu"
          rows={rows.filter((r) => r.kind === "program")}
          empty="No programs yet. Write one in the CPU Emulator and click Save to cloud."
        />
      </div>
      <FileManager userId={auth.user.id} />
    </div>
  );
}
