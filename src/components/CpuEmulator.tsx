"use client";

import { useEffect, useRef, useState } from "react";
import CloudSave from "@/components/CloudSave";
import type { CloudContext } from "@/lib/supabase/config";
import { assemble, createMachine, EXAMPLES, hex, OPS, REGS, runSteps, syntax, type Machine } from "@/lib/cpu";

const SPEEDS = [
  { label: "1 Hz", ms: 1000, steps: 1 },
  { label: "5 Hz", ms: 200, steps: 1 },
  { label: "25 Hz", ms: 40, steps: 1 },
  { label: "100 Hz", ms: 10, steps: 1 },
  { label: "Turbo", ms: 16, steps: 500 },
];

function savedSource(data: unknown): string | null {
  const d = data as { source?: unknown } | null;
  return d && typeof d.source === "string" ? d.source : null;
}

function Flag({ name, on, title }: { name: string; on: boolean; title: string }) {
  return (
    <div className="flex flex-col items-center gap-1" title={title}>
      <span
        className={`h-4 w-4 rounded-full border ${on ? "border-amber-300 bg-amber-400 shadow-[0_0_10px_#fbbf24]" : "border-slate-600 bg-slate-800"}`}
      />
      <span className="font-mono text-xs text-slate-400">{name}</span>
    </div>
  );
}

export default function CpuEmulator({ cloud }: { cloud: CloudContext }) {
  const initialSource = (cloud.project && savedSource(cloud.project.data)) ?? EXAMPLES[0].code;
  const [source, setSource] = useState(initialSource);
  const [program, setProgram] = useState(() => assemble(initialSource));
  const [machine, setMachine] = useState<Machine>(() => createMachine(assemble(initialSource).memory));
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [exampleName, setExampleName] = useState(cloud.project ? "" : EXAMPLES[0].name);
  const listRef = useRef<HTMLDivElement>(null);

  const dirty = source !== program.source;
  const hasErrors = program.errors.length > 0;
  const active = running && !machine.halted;

  useEffect(() => {
    if (!active) return;
    const { ms, steps } = SPEEDS[speed];
    const id = setInterval(() => setMachine((m) => runSteps(m, steps)), ms);
    return () => clearInterval(id);
  }, [active, speed]);

  // Keep the current instruction visible inside the listing panel.
  useEffect(() => {
    const box = listRef.current;
    const row = box?.querySelector<HTMLElement>('[data-current="true"]');
    if (!box || !row) return;
    if (row.offsetTop < box.scrollTop || row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = row.offsetTop - box.clientHeight / 2;
    }
  }, [machine.pc]);

  const load = (code: string) => {
    const p = assemble(code);
    setProgram(p);
    setRunning(false);
    if (!p.errors.length) setMachine(createMachine(p.memory));
  };

  const reset = () => {
    setRunning(false);
    setMachine(createMachine(program.memory));
  };

  const status = machine.error
    ? { text: "Fault", cls: "bg-rose-500/20 text-rose-300" }
    : machine.halted
      ? { text: "Halted", cls: "bg-slate-700 text-slate-300" }
      : active
        ? { text: "Running", cls: "bg-emerald-500/20 text-emerald-300" }
        : { text: "Ready", cls: "bg-sky-500/20 text-sky-300" };

  const byMnemonic = Array.from(new Set(OPS.map((o) => o.mn))).map((mn) => OPS.filter((o) => o.mn === mn));

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center gap-2 p-3">
        <select
          value={exampleName}
          onChange={(e) => {
            const ex = EXAMPLES.find((x) => x.name === e.target.value);
            if (!ex) return;
            setExampleName(ex.name);
            setSource(ex.code);
            load(ex.code);
          }}
          className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm"
          aria-label="Load example program"
        >
          <option value="" disabled>
            Load example…
          </option>
          {EXAMPLES.map((ex) => (
            <option key={ex.name}>{ex.name}</option>
          ))}
        </select>
        <button className={`btn ${dirty ? "btn-primary" : ""}`} onClick={() => load(source)}>
          ⚙ Assemble
        </button>
        <span className="mx-1 h-6 w-px bg-slate-700" />
        <button
          className="btn"
          disabled={hasErrors || dirty || machine.halted}
          onClick={() => {
            setRunning(false);
            setMachine((m) => runSteps(m, 1));
          }}
        >
          Step
        </button>
        <button
          className={`btn ${active ? "" : "btn-primary"}`}
          disabled={hasErrors || dirty || machine.halted}
          onClick={() => setRunning((r) => !r)}
        >
          {active ? "❚❚ Pause" : "▶ Run"}
        </button>
        <button className="btn" disabled={hasErrors} onClick={reset}>
          ↺ Reset
        </button>
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm"
          aria-label="Clock speed"
        >
          {SPEEDS.map((s, i) => (
            <option key={s.label} value={i}>
              Clock: {s.label}
            </option>
          ))}
        </select>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.cls}`}>{status.text}</span>
        <div className="ml-auto">
          <CloudSave cloud={cloud} kind="program" data={{ source }} defaultName={exampleName || "My program"} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_280px]">
        <div className="panel flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-xs text-slate-400">
            <span className="font-semibold tracking-wide uppercase">Assembly source</span>
            {dirty && <span className="text-amber-400">Edited. Click Assemble.</span>}
          </div>
          <textarea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            spellCheck={false}
            className="h-[420px] w-full resize-none bg-transparent p-3 font-mono text-[13px] leading-5 text-slate-200 outline-none"
            aria-label="Assembly source code"
          />
          {hasErrors && (
            <ul className="max-h-32 overflow-auto border-t border-rose-900/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
              {program.errors.map((e, i) => (
                <li key={i}>
                  <span className="font-mono text-rose-400">line {e.line}:</span> {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-xs text-slate-400">
            <span className="font-semibold tracking-wide uppercase">Machine code listing</span>
            <span>{program.size} / 256 bytes</span>
          </div>
          <div ref={listRef} className="relative h-[420px] overflow-auto py-1 font-mono text-[12px] leading-5">
            {program.listing
              .filter((l) => l.bytes.length || l.text.trim())
              .map((l) => {
                const current = !dirty && !hasErrors && l.bytes.length > 0 && l.addr === machine.pc;
                return (
                  <div
                    key={l.line}
                    data-current={current}
                    className={`grid grid-cols-[2.5rem_7.5rem_1fr] gap-2 px-3 whitespace-pre ${
                      current ? "bg-amber-400/15 text-amber-100" : "text-slate-400"
                    }`}
                  >
                    <span className={l.bytes.length ? "text-slate-500" : "text-transparent"}>{hex(l.addr)}</span>
                    <span className="overflow-hidden text-ellipsis text-sky-300/80">{l.bytes.map((b) => hex(b)).join(" ")}</span>
                    <span className="overflow-hidden text-ellipsis">{l.text.trim()}</span>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel p-4">
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">Registers</h3>
            <div className="space-y-1.5 font-mono text-sm">
              {REGS.map((r, i) => (
                <div key={r} className="flex items-center justify-between rounded bg-slate-900/70 px-2.5 py-1.5">
                  <span className="font-bold text-sky-300">{r}</span>
                  <span className="text-slate-500">{machine.regs[i].toString(2).padStart(8, "0")}</span>
                  <span>
                    {hex(machine.regs[i])}
                    <span className="ml-2 inline-block w-8 text-right text-slate-500">{machine.regs[i]}</span>
                  </span>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <div className="rounded bg-amber-500/10 px-2.5 py-1.5">
                  <span className="text-amber-300">PC</span> {hex(machine.pc)}
                </div>
                <div className="rounded bg-violet-500/10 px-2.5 py-1.5">
                  <span className="text-violet-300">SP</span> {hex(machine.sp)}
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-around">
              <Flag name="Z" on={machine.z} title="Zero: last result was 0" />
              <Flag name="C" on={machine.c} title="Carry: unsigned overflow or borrow" />
              <Flag name="N" on={machine.n} title="Negative: bit 7 of last result" />
              <div className="text-center">
                <div className="font-mono text-sm">{machine.cycles}</div>
                <div className="text-xs text-slate-400">cycles</div>
              </div>
            </div>
          </div>

          <div className="panel p-4">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Output</h3>
            <pre className="h-40 overflow-auto rounded bg-black/60 p-2 font-mono text-sm text-emerald-300">
              {machine.output || <span className="text-slate-600">(nothing yet)</span>}
            </pre>
            {machine.error && <p className="mt-2 text-xs text-rose-400">{machine.error}</p>}
          </div>
        </div>
      </div>

      <div className="panel overflow-x-auto p-4">
        <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-400">
          <h3 className="font-semibold tracking-wide uppercase">Memory (256 bytes)</h3>
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" />
            PC
          </span>
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-violet-500" />
            SP
          </span>
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
            last write
          </span>
          <span>Code and data sit at the bottom of memory. The stack grows down from 0xFF.</span>
        </div>
        <table className="font-mono text-[12px]">
          <thead>
            <tr className="text-slate-500">
              <th className="pr-3" />
              {Array.from({ length: 16 }, (_, c) => (
                <th key={c} className="w-7 font-normal">
                  {hex(c, 1)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 16 }, (_, r) => (
              <tr key={r}>
                <td className="pr-3 text-slate-500">{hex(r * 16)}</td>
                {Array.from({ length: 16 }, (_, c) => {
                  const addr = r * 16 + c;
                  const v = machine.mem[addr];
                  const cls =
                    addr === machine.pc
                      ? "bg-amber-400 text-slate-950"
                      : addr === machine.lastWrite
                        ? "bg-emerald-500 text-slate-950"
                        : addr === machine.sp
                          ? "bg-violet-500/80 text-white"
                          : addr > machine.sp
                            ? "bg-violet-500/10 text-violet-200"
                            : v
                              ? "text-slate-200"
                              : "text-slate-700";
                  return (
                    <td key={c} className={`rounded text-center ${cls}`} title={`0x${hex(addr)} = ${v}`}>
                      {hex(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="panel p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-300">
          Instruction set reference (4 registers, 8-bit data, 256-byte address space)
        </summary>
        <div className="mt-4 grid gap-x-8 gap-y-2 text-sm md:grid-cols-2">
          {byMnemonic.map((defs) => (
            <div key={defs[0].mn} className="flex gap-3">
              <div className="w-48 shrink-0 font-mono text-sky-300">
                {defs.map((d) => (
                  <div key={d.code}>
                    <span className="mr-2 text-slate-600">{hex(d.code)}</span>
                    {syntax(d)}
                  </div>
                ))}
              </div>
              <div className="text-slate-400">{defs[0].desc}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-400">
          Syntax: <code className="text-slate-200">label:</code> defines an address. <code className="text-slate-200">; text</code> is a
          comment. Numbers can be <code className="text-slate-200">42</code>, <code className="text-slate-200">0x2A</code>,{" "}
          <code className="text-slate-200">0b101010</code> or <code className="text-slate-200">&apos;*&apos;</code>.{" "}
          <code className="text-slate-200">DB 1, 2, &quot;text&quot;</code> puts raw bytes in memory, and{" "}
          <code className="text-slate-200">[label+1]</code> adds an offset to an address.
        </p>
      </details>
    </div>
  );
}
