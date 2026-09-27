"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FILES_BUCKET } from "@/lib/supabase/config";

const MAX_BYTES = 10 * 1024 * 1024;

interface StoredFile {
  name: string;
  size: number;
  created: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function fetchFiles(userId: string): Promise<{ files: StoredFile[]; error: string | null }> {
  const { data, error } = await createClient()
    .storage.from(FILES_BUCKET)
    .list(userId, { limit: 200, sortBy: { column: "created_at", order: "desc" } });
  if (error) return { files: [], error: error.message };
  return {
    files: data
      .filter((f) => f.id) // folder placeholders have no id
      .map((f) => ({ name: f.name, size: f.metadata?.size ?? 0, created: f.created_at ?? "" })),
    error: null,
  };
}

/** Each user's files live under `<user id>/` in a private bucket, enforced by storage policies. */
export default function FileManager({ userId }: { userId: string }) {
  const [files, setFiles] = useState<StoredFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const res = await fetchFiles(userId);
    setFiles(res.files);
    setError(res.error);
  };

  useEffect(() => {
    let cancelled = false;
    fetchFiles(userId).then((res) => {
      if (cancelled) return;
      setFiles(res.files);
      setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    const storage = createClient().storage.from(FILES_BUCKET);
    for (const file of Array.from(list)) {
      if (file.size > MAX_BYTES) {
        setError(`${file.name} is larger than 10 MB`);
        continue;
      }
      const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
      setBusy(`Uploading ${safeName}…`);
      const { error } = await storage.upload(`${userId}/${safeName}`, file, { upsert: true, contentType: file.type || undefined });
      if (error) setError(`${safeName}: ${error.message}`);
    }
    setBusy(null);
    if (inputRef.current) inputRef.current.value = "";
    await refresh();
  };

  const download = async (name: string) => {
    const { data, error } = await createClient()
      .storage.from(FILES_BUCKET)
      .createSignedUrl(`${userId}/${name}`, 60, { download: name });
    if (error) return setError(error.message);
    window.location.assign(data.signedUrl);
  };

  const remove = async (name: string) => {
    if (!confirm(`Delete ${name}?`)) return;
    setBusy(`Deleting ${name}…`);
    const { error } = await createClient().storage.from(FILES_BUCKET).remove([`${userId}/${name}`]);
    setBusy(null);
    if (error) setError(error.message);
    await refresh();
  };

  return (
    <div className="panel p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">🗂 Cloud file storage</h2>
          <p className="text-xs text-slate-500">
            Store lab reports, schematics, datasheets and .asm files (up to 10 MB each). Files are private to your account.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => inputRef.current?.click()} disabled={!!busy}>
          ⬆ Upload files
        </button>
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          upload(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed p-3 transition-colors ${dragOver ? "border-sky-500 bg-sky-500/10" : "border-slate-800"}`}
      >
        {busy && <p className="mb-2 text-sm text-sky-300">{busy}</p>}
        {error && (
          <p className="mb-2 text-sm text-rose-400">
            {error}{" "}
            <button className="underline" onClick={() => setError(null)}>
              dismiss
            </button>
          </p>
        )}
        {files === null ? (
          <p className="py-6 text-center text-sm text-slate-500">Loading…</p>
        ) : files.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No files yet. Drop files here or click Upload.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="py-1 font-normal">Name</th>
                <th className="py-1 font-normal">Size</th>
                <th className="py-1 font-normal">Uploaded</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {files.map((f) => (
                <tr key={f.name}>
                  <td className="max-w-xs truncate py-2">{f.name}</td>
                  <td className="py-2 text-slate-400">{formatSize(f.size)}</td>
                  <td className="py-2 text-slate-400">
                    {new Date(f.created).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button className="mr-3 text-sky-400 hover:underline" onClick={() => download(f.name)}>
                      Download
                    </button>
                    <button className="text-slate-500 hover:text-rose-400" onClick={() => remove(f.name)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-center text-xs text-slate-600">Drag and drop files anywhere in this box</p>
      </div>
    </div>
  );
}
