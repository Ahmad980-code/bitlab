import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cloudEnabled, SUPABASE_KEY, SUPABASE_URL, type CloudContext, type ProjectKind } from "./config";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

/** Returns the signed-in user, verified with the Supabase Auth server. */
export async function getUser() {
  if (!cloudEnabled) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getCloudContext(projectId: string | undefined, kind: ProjectKind): Promise<CloudContext> {
  if (!cloudEnabled) return { enabled: false, userEmail: null, project: null };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { enabled: true, userEmail: null, project: null };

  let project: CloudContext["project"] = null;
  if (projectId) {
    // Row-level security guarantees users can only read their own projects.
    const { data } = await supabase
      .from("projects")
      .select("id, name, data")
      .eq("id", projectId)
      .eq("kind", kind)
      .maybeSingle();
    project = data;
  }
  return { enabled: true, userEmail: auth.user.email ?? null, project };
}
