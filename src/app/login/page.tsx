import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { safeNext } from "@/lib/safe-next";
import { cloudEnabled } from "@/lib/supabase/config";
import { getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in" };

export default async function Page({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);

  if (!cloudEnabled) {
    return (
      <div className="panel mx-auto mt-10 max-w-md p-6 text-sm text-slate-300">
        <h1 className="mb-2 text-xl font-semibold">Cloud is not configured</h1>
        <p className="text-slate-400">
          Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to{" "}
          <code>.env.local</code> (see the README), then restart the dev server.
        </p>
      </div>
    );
  }
  if (await getUser()) redirect(next);

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <LoginForm next={next} confirmError={params.error === "confirm"} />
    </div>
  );
}
