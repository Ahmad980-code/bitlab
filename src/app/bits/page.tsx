import type { Metadata } from "next";
import BitLab from "@/components/BitLab";

export const metadata: Metadata = { title: "Bit Lab" };

export default function Page() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Bit Lab</h1>
        <p className="text-sm text-slate-400">
          Number systems, two&apos;s complement, IEEE-754 floats and bitwise operations. Click any bit to flip it.
        </p>
      </header>
      <BitLab />
    </div>
  );
}
