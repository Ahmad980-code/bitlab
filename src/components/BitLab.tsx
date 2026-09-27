"use client";

import { useState } from "react";

type Width = 8 | 16 | 32;
type Op = "AND" | "OR" | "XOR" | "NOT" | "ADD" | "SUB" | "SHL" | "SHR" | "SAR" | "ROL" | "ROR";

const OPS: { op: Op; label: string; hint: string }[] = [
  { op: "AND", label: "A & B", hint: "1 only where both bits are 1" },
  { op: "OR", label: "A | B", hint: "1 where either bit is 1" },
  { op: "XOR", label: "A ^ B", hint: "1 where the bits differ" },
  { op: "NOT", label: "~A", hint: "Flip every bit of A" },
  { op: "ADD", label: "A + B", hint: "Binary addition with carry" },
  { op: "SUB", label: "A − B", hint: "Adds A to the two's complement of B" },
  { op: "SHL", label: "A << B", hint: "Shift left, which multiplies by 2ᴮ" },
  { op: "SHR", label: "A >>> B", hint: "Logical shift right, filling with zeros" },
  { op: "SAR", label: "A >> B", hint: "Arithmetic shift right, keeping the sign bit" },
  { op: "ROL", label: "rol(A, B)", hint: "Rotate left, bits wrap around" },
  { op: "ROR", label: "ror(A, B)", hint: "Rotate right, bits wrap around" },
];

const maxOf = (w: Width) => (w === 32 ? 0xffffffff : (1 << w) - 1);
const toU = (v: number, w: Width) => (w === 32 ? v >>> 0 : v & maxOf(w));
const toS = (v: number, w: Width) => (w === 32 ? v | 0 : v & (1 << (w - 1)) ? v - (1 << w) : v);
const signBit = (v: number, w: Width) => (toU(v, w) >>> (w - 1)) & 1;

const toBin = (v: number, w: Width) =>
  toU(v, w)
    .toString(2)
    .padStart(w, "0")
    .replace(/(.{4})(?=.)/g, "$1 ");
const toHex = (v: number, w: Width) => toU(v, w).toString(16).toUpperCase().padStart(w / 4, "0");

const clean = (s: string) => s.replace(/[\s_]/g, "");

function f32FromBits(u: number) {
  const dv = new DataView(new ArrayBuffer(4));
  dv.setUint32(0, u);
  return dv.getFloat32(0);
}

function bitsFromF32(f: number) {
  const dv = new DataView(new ArrayBuffer(4));
  dv.setFloat32(0, f);
  return dv.getUint32(0);
}

function compute(op: Op, a: number, b: number, w: Width) {
  const n = b % w;
  let result: number;
  let carry: boolean | undefined;
  let overflow: boolean | undefined;
  switch (op) {
    case "AND":
      result = a & b;
      break;
    case "OR":
      result = a | b;
      break;
    case "XOR":
      result = a ^ b;
      break;
    case "NOT":
      result = ~a;
      break;
    case "ADD": {
      const sum = a + b;
      result = sum;
      carry = sum > maxOf(w);
      overflow = signBit(a, w) === signBit(b, w) && signBit(sum, w) !== signBit(a, w);
      break;
    }
    case "SUB": {
      result = a - b;
      carry = a < b;
      overflow = signBit(a, w) !== signBit(b, w) && signBit(result, w) !== signBit(a, w);
      break;
    }
    case "SHL":
      result = n === 0 ? a : a << n;
      carry = n > 0 && ((a >>> (w - n)) & 1) === 1;
      break;
    case "SHR":
      result = a >>> n;
      carry = n > 0 && ((a >>> (n - 1)) & 1) === 1;
      break;
    case "SAR":
      result = toS(a, w) >> n;
      break;
    case "ROL":
      result = n === 0 ? a : (a << n) | (a >>> (w - n));
      break;
    case "ROR":
      result = n === 0 ? a : (a >>> n) | (a << (w - n));
      break;
  }
  return { result: toU(result, w), carry, overflow, shift: n };
}

function NumField({
  label,
  display,
  parse,
  onValue,
  mono = true,
}: {
  label: string;
  display: string;
  parse: (s: string) => number | null;
  onValue: (v: number) => void;
  mono?: boolean;
}) {
  // While focused, keep the user's raw text so partial input like "0x" isn't reformatted.
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && draft.trim() !== "" && parse(draft) === null;
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium tracking-wide text-slate-400 uppercase">{label}</span>
      <input
        value={draft ?? display}
        spellCheck={false}
        onFocus={() => setDraft(display)}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = parse(e.target.value);
          if (v !== null) onValue(v);
        }}
        className={`w-full rounded-md border bg-slate-900 px-3 py-2 text-sm outline-none ${mono ? "font-mono" : ""} ${
          invalid ? "border-rose-500" : "border-slate-700 focus:border-sky-500"
        }`}
      />
    </label>
  );
}

function BitRow({ value, width, onToggle, float }: { value: number; width: Width; onToggle?: (bit: number) => void; float?: boolean }) {
  const u = toU(value, width);
  const color = (i: number) => {
    if (!float) return "on";
    if (i === 31) return "sign";
    if (i >= 23) return "exp";
    return "man";
  };
  const palette = {
    on: "bg-sky-500 text-slate-950 border-sky-400",
    sign: "bg-rose-500 text-slate-950 border-rose-400",
    exp: "bg-amber-400 text-slate-950 border-amber-300",
    man: "bg-emerald-400 text-slate-950 border-emerald-300",
  } as const;
  const offBorder = {
    on: "border-slate-700",
    sign: "border-rose-900",
    exp: "border-amber-900",
    man: "border-emerald-900",
  } as const;

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-3">
      {Array.from({ length: width / 4 }, (_, g) => (
        <div key={g} className="flex gap-1">
          {Array.from({ length: 4 }, (_, k) => {
            const i = width - 1 - (g * 4 + k);
            const on = ((u >>> i) & 1) === 1;
            const c = color(i);
            return (
              <button
                key={i}
                type="button"
                disabled={!onToggle}
                onClick={() => onToggle?.(i)}
                title={`bit ${i} (2^${i})`}
                className={`flex h-11 w-8 flex-col items-center justify-center rounded border font-mono transition-colors ${
                  on ? palette[c] : `bg-slate-900 text-slate-500 ${offBorder[c]}`
                } ${onToggle ? "cursor-pointer hover:brightness-125" : "cursor-default"}`}
              >
                <span className="text-sm font-bold">{on ? 1 : 0}</span>
                <span className={`text-[9px] ${on ? "text-slate-900/70" : "text-slate-600"}`}>{i}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-slate-900/70 px-3 py-2">
      <div className="text-[11px] tracking-wide text-slate-500 uppercase">{label}</div>
      <div className="font-mono text-sm text-slate-200">{value}</div>
    </div>
  );
}

export default function BitLab() {
  const [width, setWidth] = useState<Width>(8);
  const [value, setValue] = useState(42);
  const [b, setB] = useState(3);
  const [op, setOp] = useState<Op>("ADD");

  const max = maxOf(width);
  const u = toU(value, width);
  const s = toS(u, width);

  const parsers = {
    unsigned: (t: string) => (/^\d+$/.test(clean(t)) && Number(clean(t)) <= max ? Number(clean(t)) : null),
    signed: (t: string) => {
      const c = clean(t);
      if (!/^-?\d+$/.test(c)) return null;
      const n = Number(c);
      return n >= -(2 ** (width - 1)) && n < 2 ** (width - 1) ? toU(n, width) : null;
    },
    hex: (t: string) => {
      const c = clean(t).replace(/^0x/i, "");
      return /^[0-9a-f]+$/i.test(c) && parseInt(c, 16) <= max ? parseInt(c, 16) : null;
    },
    bin: (t: string) => {
      const c = clean(t).replace(/^0b/i, "");
      return /^[01]+$/.test(c) && c.length <= width ? parseInt(c, 2) : null;
    },
    oct: (t: string) => {
      const c = clean(t).replace(/^0o/i, "");
      return /^[0-7]+$/.test(c) && parseInt(c, 8) <= max ? parseInt(c, 8) : null;
    },
    float: (t: string) => {
      const c = t.trim().toLowerCase();
      if (c === "nan") return bitsFromF32(NaN);
      if (c === "inf" || c === "infinity" || c === "-inf" || c === "-infinity") return bitsFromF32(c.startsWith("-") ? -Infinity : Infinity);
      return c !== "" && !isNaN(Number(c)) ? bitsFromF32(Number(c)) : null;
    },
    ascii: (t: string) => (t.length === 1 && t.charCodeAt(0) <= 255 ? t.charCodeAt(0) : null),
  };

  const popcount = u.toString(2).replace(/0/g, "").length;
  const leadingZeros = Math.clz32(u) - (32 - width);
  const trailingZeros = u === 0 ? width : 31 - Math.clz32(u & -u);
  const f = f32FromBits(u);
  const exponent = (u >>> 23) & 0xff;
  const res = compute(op, u, toU(b, width), width);

  return (
    <div className="space-y-6">
      <div className="panel space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            Value <span className="font-mono text-sky-400">A</span>
          </h2>
          <div className="flex rounded-md border border-slate-700 p-0.5" role="radiogroup" aria-label="Bit width">
            {([8, 16, 32] as Width[]).map((w) => (
              <button
                key={w}
                role="radio"
                aria-checked={width === w}
                onClick={() => {
                  setWidth(w);
                  setValue((v) => toU(v, w));
                  setB((v) => toU(v, w));
                }}
                className={`rounded px-3 py-1 text-sm ${width === w ? "bg-sky-500 text-slate-950" : "text-slate-400 hover:text-slate-200"}`}
              >
                {w}-bit
              </button>
            ))}
          </div>
        </div>

        <BitRow value={u} width={width} float={width === 32} onToggle={(i) => setValue(toU(u ^ (2 ** i), width))} />
        {width === 32 && (
          <p className="text-xs text-slate-400">
            IEEE-754 float layout: <span className="text-rose-400">sign</span> ·{" "}
            <span className="text-amber-300">8-bit exponent</span> · <span className="text-emerald-400">23-bit mantissa</span>
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <NumField label="Decimal (unsigned)" display={String(u)} parse={parsers.unsigned} onValue={setValue} />
          <NumField label="Decimal (signed)" display={String(s)} parse={parsers.signed} onValue={setValue} />
          <NumField label="Hex" display={`0x${toHex(u, width)}`} parse={parsers.hex} onValue={setValue} />
          <NumField label="Octal" display={`0o${u.toString(8)}`} parse={parsers.oct} onValue={setValue} />
          {width === 8 ? (
            <NumField
              label="ASCII char"
              display={u >= 32 && u < 127 ? String.fromCharCode(u) : ""}
              parse={parsers.ascii}
              onValue={setValue}
            />
          ) : width === 32 ? (
            <NumField label="Float32" display={String(Number(f.toPrecision(8)))} parse={parsers.float} onValue={setValue} />
          ) : (
            <div />
          )}
          <div className="sm:col-span-2 lg:col-span-5">
            <NumField label="Binary" display={toBin(u, width)} parse={parsers.bin} onValue={setValue} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Set bits" value={popcount} />
          <Stat label="Leading zeros" value={leadingZeros} />
          <Stat label="Trailing zeros" value={trailingZeros} />
          <Stat label="Parity" value={popcount % 2 ? "odd" : "even"} />
          <Stat label="Power of 2?" value={u !== 0 && (u & (u - 1)) === 0 ? "yes" : "no"} />
          <Stat label="Range" value={`${-(2 ** (width - 1))}…${2 ** (width - 1) - 1}`} />
        </div>

        <div className="rounded-md border border-slate-800 bg-slate-900/40 p-3 text-sm text-slate-400">
          <b className="text-slate-300">Two&apos;s complement:</b> the top bit counts as −2<sup>{width - 1}</sup>, so{" "}
          <span className="font-mono text-slate-200">{toBin(u, width)}</span> ={" "}
          {signBit(u, width) ? (
            <span className="font-mono">
              −{2 ** (width - 1)} + {u - 2 ** (width - 1)} = <span className="text-sky-300">{s}</span>
            </span>
          ) : (
            <span className="font-mono text-sky-300">{s}</span>
          )}
          . To negate a number, invert the bits and add 1: −A ={" "}
          <span className="font-mono text-slate-200">0x{toHex(toU(~u + 1, width), width)}</span>.
          {width === 32 && (
            <span className="mt-2 block">
              <b className="text-slate-300">As a float:</b>{" "}
              <span className="font-mono">
                (−1)<sup>{u >>> 31}</sup> × {exponent === 0 ? "0" : "1"}.mantissa × 2
                <sup>{exponent === 0 ? -126 : exponent - 127}</sup>
              </span>{" "}
              {exponent === 0xff ? "(exponent all 1s: Infinity or NaN) " : exponent === 0 ? "(subnormal) " : ""}= stored value{" "}
              <span className="font-mono text-emerald-300">{String(f)}</span>. Try typing 0.1 into the Float32 box to see why
              0.1 + 0.2 ≠ 0.3.
            </span>
          )}
        </div>
      </div>

      <div className="panel space-y-5 p-5">
        <h2 className="text-lg font-semibold">Bitwise &amp; arithmetic operations</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
          <NumField label="Operand B (decimal or 0x hex)" display={String(toU(b, width))} parse={(t) => (/^\s*0x/i.test(t) ? parsers.hex(t) : parsers.unsigned(t))} onValue={setB} />
          <div>
            <span className="mb-1 block text-xs font-medium tracking-wide text-slate-400 uppercase">Operation</span>
            <div className="flex flex-wrap gap-1.5">
              {OPS.map((o) => (
                <button
                  key={o.op}
                  title={o.hint}
                  onClick={() => setOp(o.op)}
                  className={`rounded-md border px-2.5 py-1.5 font-mono text-xs ${
                    op === o.op ? "border-sky-500 bg-sky-500/20 text-sky-200" : "border-slate-700 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-md bg-slate-950/60 p-4 font-mono text-sm">
          <div className="grid w-max grid-cols-[4rem_auto_auto] gap-x-6 gap-y-1">
            <span className="text-slate-500">A</span>
            <span>{toBin(u, width)}</span>
            <span className="text-slate-500">
              {u} / {s}
            </span>
            {op !== "NOT" && (
              <>
                <span className="text-slate-500">B</span>
                <span>{toBin(toU(b, width), width)}</span>
                <span className="text-slate-500">{["SHL", "SHR", "SAR", "ROL", "ROR"].includes(op) ? `shift by ${res.shift}` : toU(b, width)}</span>
              </>
            )}
            <span className="col-span-3 my-1 border-t border-slate-700" />
            <span className="text-sky-400">{op}</span>
            <span className="text-sky-300">{toBin(res.result, width)}</span>
            <span className="text-sky-300">
              {res.result} / {toS(res.result, width)} / 0x{toHex(res.result, width)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {res.carry !== undefined && (
            <span className={`rounded-full px-2.5 py-1 text-xs ${res.carry ? "bg-amber-500/20 text-amber-300" : "bg-slate-800 text-slate-500"}`}>
              Carry {res.carry ? "1" : "0"}
            </span>
          )}
          {res.overflow !== undefined && (
            <span className={`rounded-full px-2.5 py-1 text-xs ${res.overflow ? "bg-rose-500/20 text-rose-300" : "bg-slate-800 text-slate-500"}`}>
              Signed overflow {res.overflow ? "1" : "0"}
            </span>
          )}
          <span className="text-sm text-slate-400">{OPS.find((o) => o.op === op)!.hint}</span>
          <button className="btn ml-auto" onClick={() => setValue(res.result)}>
            Use result as A
          </button>
        </div>
      </div>
    </div>
  );
}
