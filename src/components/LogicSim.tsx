"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CloudSave from "@/components/CloudSave";
import type { CloudContext } from "@/lib/supabase/config";
import {
  expression,
  GATES,
  INPUT_COUNT,
  inputPinPos,
  outputPinPos,
  PRESETS,
  simulate,
  type CNode,
  type GateType,
  type Preset,
  type Wire,
} from "@/lib/logic";

const W = 1000;
const H = 520;
const HIGH = "#34d399";
const LOW = "#475569";
const MAX_TABLE_INPUTS = 6;

interface Circuit {
  nodes: CNode[];
  wires: Wire[];
  values: Record<string, boolean>;
  stable: boolean;
}

type Selection = { kind: "node" | "wire"; id: string } | null;

const uid = () => Math.random().toString(36).slice(2, 10);

function withSim(nodes: CNode[], wires: Wire[], seed: Record<string, boolean> = {}): Circuit {
  return { nodes, wires, ...simulate(nodes, wires, seed) };
}

function fromPreset(p: Preset): Circuit {
  const nodes = p.nodes.map((n) => ({ ...n }));
  const wires = p.wires.map(([from, to, pin]) => ({ id: uid(), from, to, pin }));
  return withSim(nodes, wires);
}

function fromSaved(data: unknown): Circuit | null {
  const d = data as { nodes?: unknown; wires?: unknown } | null;
  if (!d || !Array.isArray(d.nodes) || !Array.isArray(d.wires)) return null;
  return withSim(d.nodes as CNode[], d.wires as Wire[]);
}

function nextLabel(nodes: CNode[], type: "INPUT" | "OUTPUT") {
  const used = new Set(nodes.map((n) => n.label));
  const pool = type === "INPUT" ? "ABCDEFGHIJKLMN" : "YZWVUTXQPO";
  for (const ch of pool) if (!used.has(ch)) return ch;
  return `${type === "INPUT" ? "IN" : "OUT"}${nodes.length}`;
}

function removeSelection(c: Circuit, sel: NonNullable<Selection>): Circuit {
  if (sel.kind === "wire") return withSim(c.nodes, c.wires.filter((w) => w.id !== sel.id), c.values);
  return withSim(
    c.nodes.filter((n) => n.id !== sel.id),
    c.wires.filter((w) => w.from !== sel.id && w.to !== sel.id),
    c.values,
  );
}

function wirePath(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.max(40, Math.abs(x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

/** Where each gate's body ends on the right, so the output stub can meet it. */
const BODY_END: Partial<Record<GateType, number>> = {
  AND: 52,
  NAND: 60,
  OR: 54,
  NOR: 62,
  XOR: 54,
  XNOR: 62,
  NOT: 52,
};

function GateBody({ type }: { type: GateType }) {
  const orPath = "M0 0 Q14 22 0 44 Q38 44 54 22 Q38 0 0 0 Z";
  switch (type) {
    case "AND":
    case "NAND":
      return (
        <>
          <path d="M0 0 H30 A22 22 0 0 1 30 44 H0 Z" />
          {type === "NAND" && <circle cx={56} cy={22} r={4} />}
        </>
      );
    case "OR":
    case "NOR":
      return (
        <>
          <path d={orPath} />
          {type === "NOR" && <circle cx={58} cy={22} r={4} />}
        </>
      );
    case "XOR":
    case "XNOR":
      return (
        <>
          <path d="M-7 0 Q7 22 -7 44" fill="none" />
          <path d={orPath} />
          {type === "XNOR" && <circle cx={58} cy={22} r={4} />}
        </>
      );
    case "NOT":
      return (
        <>
          <path d="M0 4 L44 22 L0 40 Z" />
          <circle cx={48} cy={22} r={4} />
        </>
      );
    default:
      return null;
  }
}

export default function LogicSim({ cloud }: { cloud: CloudContext }) {
  const [circuit, setCircuit] = useState<Circuit>(
    () => (cloud.project && fromSaved(cloud.project.data)) || fromPreset(PRESETS[0]),
  );
  const [presetName, setPresetName] = useState(cloud.project ? "" : PRESETS[0].name);
  const [selected, setSelected] = useState<Selection>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(
    null,
  );

  const { nodes, wires, values, stable } = circuit;
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const inputs = nodes.filter((n) => n.type === "INPUT");
  const outputs = nodes.filter((n) => n.type === "OUTPUT");

  const table = useMemo(() => {
    const ins = nodes.filter((n) => n.type === "INPUT");
    const outs = nodes.filter((n) => n.type === "OUTPUT");
    if (ins.length > MAX_TABLE_INPUTS || !outs.length) return null;
    return Array.from({ length: 1 << ins.length }, (_, row) => {
      const overrides: Record<string, boolean> = {};
      ins.forEach((n, k) => (overrides[n.id] = ((row >> (ins.length - 1 - k)) & 1) === 1));
      const { values } = simulate(nodes, wires, {}, overrides);
      return { ins: ins.map((n) => overrides[n.id]), outs: outs.map((n) => values[n.id]) };
    });
  }, [nodes, wires]);

  const currentRow = inputs.reduce((acc, n) => (acc << 1) | (values[n.id] ? 1 : 0), 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape") {
        setPending(null);
        setSelected(null);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault();
        setCircuit((c) => removeSelection(c, selected));
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const toSvg = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  };

  const addNode = (type: GateType) => {
    setCircuit((c) => {
      const k = c.nodes.length;
      const node: CNode = {
        id: uid(),
        type,
        x: type === "INPUT" ? 60 : type === "OUTPUT" ? 860 : 260 + (k % 5) * 90,
        y: 40 + ((k * 90) % (H - 100)),
      };
      if (type === "INPUT" || type === "OUTPUT") node.label = nextLabel(c.nodes, type);
      return withSim([...c.nodes, node], c.wires, c.values);
    });
  };

  const connect = (to: string, pin: number) => {
    if (!pending || pending === to) return;
    const from = pending;
    setCircuit((c) =>
      withSim(
        c.nodes,
        [...c.wires.filter((w) => !(w.to === to && w.pin === pin)), { id: uid(), from, to, pin }],
        c.values,
      ),
    );
    setPending(null);
  };

  const setInputs = (row: number) => {
    setCircuit((c) => {
      const ins = c.nodes.filter((n) => n.type === "INPUT");
      const nodes = c.nodes.map((n) => {
        const k = ins.indexOf(n);
        return k < 0 ? n : { ...n, value: ((row >> (ins.length - 1 - k)) & 1) === 1 };
      });
      return withSim(nodes, c.wires, c.values);
    });
  };

  const toggle = (id: string) =>
    setCircuit((c) =>
      withSim(
        c.nodes.map((n) => (n.id === id ? { ...n, value: !n.value } : n)),
        c.wires,
        c.values,
      ),
    );

  const onPointerMove = (e: React.PointerEvent) => {
    const p = toSvg(e);
    if (pending) setMouse(p);
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) > 3) d.moved = true;
    if (!d.moved) return;
    const x = Math.round(Math.min(Math.max(p.x - d.dx, 16), W - 80) / 10) * 10;
    const y = Math.round(Math.min(Math.max(p.y - d.dy, 20), H - 60) / 10) * 10;
    setCircuit((c) => ({ ...c, nodes: c.nodes.map((n) => (n.id === d.id ? { ...n, x, y } : n)) }));
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved && byId.get(d.id)?.type === "INPUT") toggle(d.id);
  };

  const pendingNode = pending ? byId.get(pending) : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="space-y-3">
        <div className="panel flex flex-wrap items-center gap-2 p-3">
          <select
            value={presetName}
            onChange={(e) => {
              const p = PRESETS.find((p) => p.name === e.target.value);
              if (!p) return;
              setPresetName(p.name);
              setCircuit(fromPreset(p));
              setSelected(null);
              setPending(null);
            }}
            className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm"
            aria-label="Load example circuit"
          >
            <option value="" disabled>
              Load example…
            </option>
            {PRESETS.map((p) => (
              <option key={p.name}>{p.name}</option>
            ))}
          </select>
          <span className="mx-1 h-6 w-px bg-slate-700" />
          <button className="btn" onClick={() => addNode("INPUT")}>
            + Switch
          </button>
          <button className="btn" onClick={() => addNode("OUTPUT")}>
            + LED
          </button>
          {GATES.map((g) => (
            <button key={g} className="btn font-mono" onClick={() => addNode(g)}>
              {g}
            </button>
          ))}
          <span className="mx-1 h-6 w-px bg-slate-700" />
          <button
            className="btn"
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              setCircuit((c) => removeSelection(c, selected));
              setSelected(null);
            }}
          >
            Delete
          </button>
          <div className="ml-auto">
            <CloudSave cloud={cloud} kind="circuit" data={{ nodes, wires }} defaultName={presetName || "My circuit"} />
          </div>
        </div>

        <div className="panel overflow-hidden">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full touch-none select-none"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerDown={() => {
              setSelected(null);
              setPending(null);
            }}
          >
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="#1e293b" />
              </pattern>
              <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>
            <rect width={W} height={H} fill="url(#grid)" />

            {wires.map((w) => {
              const src = byId.get(w.from);
              const dst = byId.get(w.to);
              if (!src || !dst) return null;
              const a = outputPinPos(src);
              const b = inputPinPos(dst, w.pin);
              const d = wirePath(a.x, a.y, b.x, b.y);
              const on = values[w.from];
              const isSel = selected?.kind === "wire" && selected.id === w.id;
              return (
                <g
                  key={w.id}
                  className="cursor-pointer"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelected({ kind: "wire", id: w.id });
                  }}
                >
                  <path d={d} stroke="transparent" strokeWidth={12} fill="none" />
                  <path
                    d={d}
                    stroke={isSel ? "#38bdf8" : on ? HIGH : LOW}
                    strokeWidth={isSel ? 4 : 3}
                    fill="none"
                    strokeLinecap="round"
                  />
                </g>
              );
            })}

            {pendingNode && mouse && (
              <path
                d={wirePath(outputPinPos(pendingNode).x, outputPinPos(pendingNode).y, mouse.x, mouse.y)}
                stroke="#38bdf8"
                strokeWidth={2}
                strokeDasharray="6 4"
                fill="none"
                pointerEvents="none"
              />
            )}

            {nodes.map((n) => {
              const isSel = selected?.kind === "node" && selected.id === n.id;
              const stroke = isSel ? "#38bdf8" : "#94a3b8";
              const on = values[n.id];
              const inCount = INPUT_COUNT[n.type];
              return (
                <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
                  <g
                    className={n.type === "INPUT" ? "cursor-pointer" : "cursor-move"}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      const p = toSvg(e);
                      drag.current = { id: n.id, dx: p.x - n.x, dy: p.y - n.y, sx: p.x, sy: p.y, moved: false };
                      svgRef.current?.setPointerCapture(e.pointerId);
                      setSelected({ kind: "node", id: n.id });
                    }}
                  >
                    {Array.from({ length: inCount }, (_, pin) => {
                      const y = inputPinPos(n, pin).y - n.y;
                      const end = n.type === "XOR" || n.type === "XNOR" ? -3 : n.type === "OUTPUT" ? 4 : 6;
                      return <line key={pin} x1={-14} y1={y} x2={end} y2={y} stroke={stroke} strokeWidth={2} />;
                    })}
                    {n.type !== "OUTPUT" && (
                      <line
                        x1={n.type === "INPUT" ? 44 : BODY_END[n.type]}
                        y1={22}
                        x2={outputPinPos(n).x - n.x}
                        y2={22}
                        stroke={stroke}
                        strokeWidth={2}
                      />
                    )}

                    {n.type === "INPUT" ? (
                      <>
                        <rect
                          width={44}
                          height={44}
                          rx={8}
                          fill={on ? "#064e3b" : "#0f172a"}
                          stroke={on ? HIGH : stroke}
                          strokeWidth={2}
                        />
                        <text x={22} y={29} textAnchor="middle" className="font-mono text-lg font-bold" fill={on ? HIGH : "#64748b"}>
                          {on ? 1 : 0}
                        </text>
                      </>
                    ) : n.type === "OUTPUT" ? (
                      <>
                        {on && <circle cx={22} cy={22} r={16} fill={HIGH} filter="url(#glow)" />}
                        <circle cx={22} cy={22} r={16} fill={on ? HIGH : "#1e293b"} stroke={stroke} strokeWidth={2} />
                      </>
                    ) : (
                      <g fill="#1e293b" stroke={stroke} strokeWidth={2}>
                        <GateBody type={n.type} />
                      </g>
                    )}

                    {n.label ? (
                      <text x={22} y={-8} textAnchor="middle" className="font-mono text-sm font-semibold" fill="#e2e8f0">
                        {n.label}
                      </text>
                    ) : (
                      <text x={26} y={60} textAnchor="middle" className="font-mono text-[10px]" fill="#64748b">
                        {n.type}
                      </text>
                    )}
                  </g>

                  {Array.from({ length: inCount }, (_, pin) => {
                    const pos = inputPinPos(n, pin);
                    const src = wires.find((w) => w.to === n.id && w.pin === pin);
                    return (
                      <circle
                        key={pin}
                        cx={pos.x - n.x}
                        cy={pos.y - n.y}
                        r={5}
                        fill={src && values[src.from] ? HIGH : "#0f172a"}
                        stroke={pending ? "#38bdf8" : "#94a3b8"}
                        strokeWidth={2}
                        className="cursor-crosshair"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          connect(n.id, pin);
                        }}
                        onPointerUp={() => connect(n.id, pin)}
                      />
                    );
                  })}
                  {n.type !== "OUTPUT" && (
                    <circle
                      cx={outputPinPos(n).x - n.x}
                      cy={22}
                      r={6}
                      fill={on ? HIGH : "#0f172a"}
                      stroke={pending === n.id ? "#38bdf8" : "#94a3b8"}
                      strokeWidth={2}
                      className="cursor-crosshair"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setPending(n.id);
                        setMouse(toSvg(e));
                      }}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <p className="text-sm text-slate-400">
          <b className="text-slate-300">Click a switch</b> to flip it. <b className="text-slate-300">Drag</b> parts to
          move them. To wire, <b className="text-slate-300">click an output pin</b> (right side), then{" "}
          <b className="text-slate-300">an input pin</b> (left side). Select something and press{" "}
          <kbd className="rounded bg-slate-800 px-1">Delete</kbd> to remove it.
          {!stable && <span className="ml-2 text-amber-400">⚠ This circuit oscillates and never settles.</span>}
        </p>
      </div>

      <aside className="space-y-4">
        <div className="panel p-4">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-300 uppercase">Truth table</h2>
          {!outputs.length || !inputs.length ? (
            <p className="text-sm text-slate-500">Add at least one switch and one LED.</p>
          ) : !table ? (
            <p className="text-sm text-slate-500">Too many inputs (max {MAX_TABLE_INPUTS}) to list every row.</p>
          ) : (
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-center font-mono text-sm">
                <thead className="sticky top-0 bg-slate-900 text-slate-400">
                  <tr>
                    {inputs.map((n) => (
                      <th key={n.id} className="px-1 py-1 font-semibold">
                        {n.label}
                      </th>
                    ))}
                    <th className="w-2 border-l border-slate-700" />
                    {outputs.map((n) => (
                      <th key={n.id} className="px-1 py-1 font-semibold text-emerald-300">
                        {n.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.map((row, i) => (
                    <tr
                      key={i}
                      onClick={() => setInputs(i)}
                      className={`cursor-pointer ${i === currentRow ? "bg-sky-500/20 text-sky-100" : "hover:bg-slate-800"}`}
                    >
                      {row.ins.map((v, k) => (
                        <td key={k} className="py-0.5">
                          {v ? 1 : 0}
                        </td>
                      ))}
                      <td className="border-l border-slate-700" />
                      {row.outs.map((v, k) => (
                        <td key={k} className={v ? "text-emerald-400" : "text-slate-500"}>
                          {v ? 1 : 0}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-slate-500">Click a row to set the switches.</p>
            </div>
          )}
        </div>

        {outputs.length > 0 && (
          <div className="panel p-4">
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-300 uppercase">Boolean expressions</h2>
            <ul className="space-y-2 font-mono text-sm">
              {outputs.map((n) => (
                <li key={n.id} className="break-words">
                  <span className="text-emerald-300">{n.label}</span> = {expression(nodes, wires, n.id)}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">· AND &nbsp; + OR &nbsp; ⊕ XOR &nbsp; ¬ NOT &nbsp; ↺ feedback loop</p>
          </div>
        )}
      </aside>
    </div>
  );
}
