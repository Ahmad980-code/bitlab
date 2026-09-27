import type { Metadata } from "next";
import LogicSim from "@/components/LogicSim";
import { getCloudContext } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Logic Circuit Simulator" };

export default async function Page({ searchParams }: PageProps<"/logic">) {
  const { project } = await searchParams;
  const cloud = await getCloudContext(typeof project === "string" ? project : undefined, "circuit");
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Logic Circuit Simulator</h1>
        <p className="text-sm text-slate-400">Build combinational and sequential circuits from basic gates.</p>
      </header>
      <LogicSim key={cloud.project?.id ?? "new"} cloud={cloud} />
    </div>
  );
}
