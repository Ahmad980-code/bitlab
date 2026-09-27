import type { Metadata } from "next";
import CpuEmulator from "@/components/CpuEmulator";
import { getCloudContext } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "8-bit CPU Emulator" };

export default async function Page({ searchParams }: PageProps<"/cpu">) {
  const { project } = await searchParams;
  const cloud = await getCloudContext(typeof project === "string" ? project : undefined, "program");
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">8-bit CPU Emulator</h1>
        <p className="text-sm text-slate-400">
          Write assembly, assemble it into machine code, and watch the fetch-decode-execute cycle run.
        </p>
      </header>
      <CpuEmulator key={cloud.project?.id ?? "new"} cloud={cloud} />
    </div>
  );
}
