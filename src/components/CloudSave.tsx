"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CloudContext, ProjectKind } from "@/lib/supabase/config";

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

export default function CloudSave({
  cloud,
  kind,
  data,
  defaultName,
}: {
  cloud: CloudContext;
  kind: ProjectKind;
  data: unknown;
  defaultName: string;
}) {
  const pathname = usePathname();
  const [projectId, setProjectId] = useState(cloud.project?.id ?? null);
  const [name, setName] = useState(cloud.project?.name ?? defaultName);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  if (!cloud.enabled) {
    return (
      <span className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400" title="Set the Supabase environment variables to enable cloud saving (see README).">
        ☁ Cloud not configured
      </span>
    );
  }

  if (!cloud.userEmail) {
    return (
      <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn">
        ☁ Sign in to save
      </Link>
    );
  }

  const save = async (asNew: boolean) => {
    const trimmed = name.trim();
    if (!trimmed) return setStatus({ kind: "error", message: "Give it a name first" });
    setStatus({ kind: "saving" });
    const supabase = createClient();
    let id = asNew ? null : projectId;
    if (id) {
      const { error } = await supabase
        .from("projects")
        .update({ name: trimmed, data, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) return setStatus({ kind: "error", message: error.message });
    } else {
      const { data: row, error } = await supabase
        .from("projects")
        .insert({ kind, name: trimmed, data })
        .select("id")
        .single();
      if (error) return setStatus({ kind: "error", message: error.message });
      id = row.id as string;
      setProjectId(id);
      // Update the URL so a refresh reopens this project, without remounting the tool.
      window.history.replaceState(null, "", `${pathname}?project=${id}`);
    }
    setStatus({ kind: "saved" });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setStatus({ kind: "idle" });
        }}
        maxLength={100}
        aria-label="Project name"
        className="w-44 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm outline-none focus:border-sky-500"
      />
      <button className="btn btn-primary" disabled={status.kind === "saving"} onClick={() => save(false)}>
        {status.kind === "saving" ? "Saving…" : projectId ? "☁ Save" : "☁ Save to cloud"}
      </button>
      {projectId && (
        <button className="btn" disabled={status.kind === "saving"} onClick={() => save(true)}>
          Save as copy
        </button>
      )}
      {status.kind === "saved" && <span className="text-xs text-emerald-400">Saved ✓</span>}
      {status.kind === "error" && <span className="text-xs text-rose-400">{status.message}</span>}
    </div>
  );
}
