export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** The tools work offline; cloud features light up once Supabase env vars are set. */
export const cloudEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);

export const FILES_BUCKET = "files";

export type ProjectKind = "circuit" | "program";

export interface ProjectRow {
  id: string;
  kind: ProjectKind;
  name: string;
  updated_at: string;
}

/** What a tool page needs to know about the cloud for the current request. */
export interface CloudContext {
  enabled: boolean;
  userEmail: string | null;
  project: { id: string; name: string; data: unknown } | null;
}
