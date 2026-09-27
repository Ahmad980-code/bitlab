export const REGS: readonly string[] = ["A", "B", "C", "D"];

/** Operand kinds: register, immediate/address, [address], [register]. */
type Kind = "r" | "i" | "m" | "p";

export interface OpDef {
  mn: string;
  ops: Kind[];
  code: number;
  desc: string;
}

const alu = (mn: string, base: number, desc: string): OpDef[] => [
  { mn, ops: ["r", "r"], code: base, desc },
  { mn, ops: ["r", "i"], code: base + 1, desc },
];

export const OPS: OpDef[] = [
  { mn: "HLT", ops: [], code: 0x00, desc: "Stop the CPU" },
  { mn: "NOP", ops: [], code: 0x01, desc: "Do nothing for one cycle" },
  { mn: "MOV", ops: ["r", "r"], code: 0x02, desc: "Copy a register or constant into a register" },
  { mn: "MOV", ops: ["r", "i"], code: 0x03, desc: "Copy a register or constant into a register" },
  { mn: "LD", ops: ["r", "m"], code: 0x04, desc: "Load a byte from memory into a register" },
  { mn: "LD", ops: ["r", "p"], code: 0x05, desc: "Load a byte from memory into a register" },
  { mn: "ST", ops: ["m", "r"], code: 0x06, desc: "Store a register into memory" },
  { mn: "ST", ops: ["p", "r"], code: 0x07, desc: "Store a register into memory" },
  ...alu("ADD", 0x10, "dst = dst + src (C = carry out)"),
  ...alu("SUB", 0x12, "dst = dst − src (C = borrow)"),
  ...alu("AND", 0x14, "dst = dst AND src"),
  ...alu("OR", 0x16, "dst = dst OR src"),
  ...alu("XOR", 0x18, "dst = dst XOR src"),
  ...alu("CMP", 0x1a, "Like SUB, but only updates the flags"),
  { mn: "INC", ops: ["r"], code: 0x20, desc: "reg = reg + 1" },
  { mn: "DEC", ops: ["r"], code: 0x21, desc: "reg = reg − 1" },
  { mn: "SHL", ops: ["r"], code: 0x22, desc: "Shift left, bit 7 goes into C" },
  { mn: "SHR", ops: ["r"], code: 0x23, desc: "Shift right, bit 0 goes into C" },
  { mn: "NOT", ops: ["r"], code: 0x24, desc: "Invert every bit" },
  { mn: "JMP", ops: ["i"], code: 0x30, desc: "Jump to address" },
  { mn: "JZ", ops: ["i"], code: 0x31, desc: "Jump if Z (zero) is set" },
  { mn: "JNZ", ops: ["i"], code: 0x32, desc: "Jump if Z is clear" },
  { mn: "JC", ops: ["i"], code: 0x33, desc: "Jump if C (carry) is set" },
  { mn: "JNC", ops: ["i"], code: 0x34, desc: "Jump if C is clear" },
  { mn: "JN", ops: ["i"], code: 0x35, desc: "Jump if N (negative, bit 7) is set" },
  { mn: "PUSH", ops: ["r"], code: 0x40, desc: "Push a register onto the stack" },
  { mn: "POP", ops: ["r"], code: 0x41, desc: "Pop the top of the stack into a register" },
  { mn: "CALL", ops: ["i"], code: 0x42, desc: "Push return address, jump to subroutine" },
  { mn: "RET", ops: [], code: 0x43, desc: "Return from subroutine" },
  { mn: "OUT", ops: ["r"], code: 0x50, desc: "Print a register as a number" },
  { mn: "OUTC", ops: ["r"], code: 0x51, desc: "Print a register as an ASCII character" },
];

const BY_CODE = new Map(OPS.map((o) => [o.code, o]));
const JUMPS = new Set(["JMP", "JZ", "JNZ", "JC", "JNC", "JN", "CALL"]);

export function syntax(o: OpDef): string {
  const names = o.ops.map((k) =>
    k === "r" ? "reg" : k === "p" ? "[reg]" : k === "m" ? "[addr]" : JUMPS.has(o.mn) ? "addr" : "imm",
  );
  return `${o.mn} ${names.join(", ")}`.trim();
}

export const hex = (v: number, digits = 2) => v.toString(16).toUpperCase().padStart(digits, "0");

// ───────────────────────────── Assembler ─────────────────────────────

export interface AsmError {
  line: number;
  message: string;
}

export interface ListingLine {
  line: number;
  addr: number;
  bytes: number[];
  text: string;
}

export interface Program {
  source: string;
  memory: number[];
  listing: ListingLine[];
  errors: AsmError[];
  size: number;
}

type Arg = { kind: "r" | "p"; reg: number } | { kind: "i" | "m"; expr: string };

type Item =
  | { kind: "op"; line: number; def: OpDef; args: Arg[]; out: ListingLine }
  | { kind: "db"; line: number; parts: string[]; out: ListingLine };

function stripComment(s: string): string {
  let quote: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === ";") return s.slice(0, i);
  }
  return s;
}

function splitArgs(s: string): string[] {
  const parts: string[] = [];
  let quote: string | null = null;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      cur += ch;
      if (ch === "\\" && i + 1 < s.length) cur += s[++i];
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
    } else if (ch === ",") {
      parts.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim() || parts.length) parts.push(cur.trim());
  return parts;
}

const ESCAPES: Record<string, number> = { n: 10, t: 9, r: 13, "0": 0, "\\": 92, "'": 39, '"': 34 };

function unescape(body: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "\\" && i + 1 < body.length) {
      const e = body[++i];
      out.push(ESCAPES[e] ?? e.charCodeAt(0));
    } else out.push(body.charCodeAt(i));
  }
  return out;
}

function parseArg(s: string): Arg {
  const r = REGS.indexOf(s.toUpperCase());
  if (r >= 0) return { kind: "r", reg: r };
  const m = /^\[\s*(.+?)\s*\]$/.exec(s);
  if (m) {
    const inner = REGS.indexOf(m[1].toUpperCase());
    return inner >= 0 ? { kind: "p", reg: inner } : { kind: "m", expr: m[1] };
  }
  return { kind: "i", expr: s };
}

function evalExpr(expr: string, labels: Map<string, number>): number | string {
  const e = expr.trim();
  let v: number | undefined;
  let m: RegExpExecArray | null;
  if ((m = /^'(\\?.)'$/.exec(e))) v = unescape(m[1])[0];
  else if (/^-?\d+$/.test(e)) v = parseInt(e, 10);
  else if (/^0x[0-9a-f]+$/i.test(e)) v = parseInt(e.slice(2), 16);
  else if (/^0b[01]+$/i.test(e)) v = parseInt(e.slice(2), 2);
  else if ((m = /^([a-z_]\w*)\s*(?:([+-])\s*(\d+))?$/i.exec(e))) {
    const base = labels.get(m[1].toLowerCase());
    if (base === undefined) return `Unknown label "${m[1]}"`;
    v = base + (m[2] ? (m[2] === "+" ? 1 : -1) * parseInt(m[3], 10) : 0);
  } else return `Can't understand "${e}"`;
  if (v < -128 || v > 255) return `Value ${v} doesn't fit in a byte`;
  return v & 0xff;
}

export function assemble(source: string): Program {
  const lines = source.split(/\r?\n/);
  const labels = new Map<string, number>();
  const errors: AsmError[] = [];
  const listing: ListingLine[] = [];
  const items: Item[] = [];
  let addr = 0;

  // Pass 1: find labels and instruction sizes.
  lines.forEach((raw, i) => {
    const line = i + 1;
    const out: ListingLine = { line, addr, bytes: [], text: raw };
    listing.push(out);
    let s = stripComment(raw).trim();

    const lm = /^([a-z_]\w*):\s*/i.exec(s);
    if (lm) {
      const name = lm[1].toLowerCase();
      if (REGS.includes(lm[1].toUpperCase())) errors.push({ line, message: `"${lm[1]}" is a register name` });
      else if (labels.has(name)) errors.push({ line, message: `Label "${lm[1]}" is defined twice` });
      else labels.set(name, addr);
      s = s.slice(lm[0].length);
    }
    if (!s) return;

    const [, word, rest] = /^(\S+)\s*(.*)$/.exec(s)!;
    const mn = word.toUpperCase();

    if (mn === "DB") {
      const parts = splitArgs(rest);
      if (!parts.length) errors.push({ line, message: "DB needs at least one value" });
      items.push({ kind: "db", line, parts, out });
      for (const p of parts) addr += /^".*"$/.test(p) ? unescape(p.slice(1, -1)).length : 1;
      return;
    }

    const defs = OPS.filter((o) => o.mn === mn);
    if (!defs.length) {
      errors.push({ line, message: `Unknown instruction "${word}"` });
      return;
    }
    const args = splitArgs(rest).map(parseArg);
    const def = defs.find((d) => d.ops.length === args.length && d.ops.every((k, j) => k === args[j].kind));
    if (!def) {
      errors.push({ line, message: `Invalid operands. Expected: ${defs.map(syntax).join("  or  ")}` });
      return;
    }
    items.push({ kind: "op", line, def, args, out });
    addr += 1 + def.ops.length;
  });

  // Pass 2: emit bytes now that every label address is known.
  const memory = new Array(256).fill(0);
  for (const item of items) {
    const bytes: number[] = [];
    const emit = (v: number | string) => {
      if (typeof v === "string") errors.push({ line: item.line, message: v });
      else bytes.push(v);
    };
    if (item.kind === "db") {
      for (const p of item.parts) {
        if (/^".*"$/.test(p)) bytes.push(...unescape(p.slice(1, -1)));
        else emit(evalExpr(p, labels));
      }
    } else {
      bytes.push(item.def.code);
      for (const a of item.args) emit("reg" in a ? a.reg : evalExpr(a.expr, labels));
    }
    item.out.bytes = bytes;
    bytes.forEach((b, j) => {
      if (item.out.addr + j < 256) memory[item.out.addr + j] = b;
    });
  }
  if (addr > 256) errors.push({ line: lines.length, message: `Program is ${addr} bytes, but memory is only 256` });

  errors.sort((a, b) => a.line - b.line);
  return { source, memory, listing, errors, size: addr };
}

// ───────────────────────────── Emulator ─────────────────────────────

export interface Machine {
  mem: number[];
  regs: number[];
  pc: number;
  sp: number;
  z: boolean;
  c: boolean;
  n: boolean;
  halted: boolean;
  error: string | null;
  output: string;
  cycles: number;
  lastWrite: number | null;
}

export function createMachine(memory: number[]): Machine {
  return {
    mem: [...memory],
    regs: [0, 0, 0, 0],
    pc: 0,
    sp: 0xff,
    z: false,
    c: false,
    n: false,
    halted: false,
    error: null,
    output: "",
    cycles: 0,
    lastWrite: null,
  };
}

/** Runs up to `count` instructions and returns a new machine state. */
export function runSteps(m: Machine, count: number): Machine {
  if (m.halted) return m;
  const s = { ...m, mem: m.mem.slice(), regs: m.regs.slice() };
  for (let i = 0; i < count && !s.halted; i++) step(s);
  return s;
}

function setZN(m: Machine, v: number) {
  m.z = v === 0;
  m.n = (v & 0x80) !== 0;
}

function fault(m: Machine, message: string) {
  m.halted = true;
  m.error = message;
}

function step(m: Machine) {
  const at = m.pc;
  const next = () => {
    const b = m.mem[m.pc];
    m.pc = (m.pc + 1) & 0xff;
    return b;
  };

  const def = BY_CODE.get(next());
  if (!def) return fault(m, `Illegal opcode 0x${hex(m.mem[at])} at address 0x${hex(at)}`);
  const a = def.ops.map(() => next());
  for (let i = 0; i < a.length; i++) {
    if ((def.ops[i] === "r" || def.ops[i] === "p") && a[i] > 3)
      return fault(m, `Invalid register number ${a[i]} at address 0x${hex(at)}`);
  }

  m.cycles++;
  m.lastWrite = null;
  const R = m.regs;
  const push = (v: number) => {
    m.mem[m.sp] = v;
    m.lastWrite = m.sp;
    m.sp = (m.sp - 1) & 0xff;
  };
  const pop = () => {
    m.sp = (m.sp + 1) & 0xff;
    return m.mem[m.sp];
  };
  const jumpIf = (cond: boolean) => {
    if (cond) m.pc = a[0];
  };

  switch (def.mn) {
    case "HLT":
      m.halted = true;
      m.pc = at;
      break;
    case "NOP":
      break;
    case "MOV":
      R[a[0]] = def.ops[1] === "r" ? R[a[1]] : a[1];
      break;
    case "LD":
      R[a[0]] = m.mem[def.ops[1] === "p" ? R[a[1]] : a[1]];
      break;
    case "ST": {
      const addr = def.ops[0] === "p" ? R[a[0]] : a[0];
      m.mem[addr] = R[a[1]];
      m.lastWrite = addr;
      break;
    }
    case "ADD":
    case "SUB":
    case "CMP":
    case "AND":
    case "OR":
    case "XOR": {
      const x = R[a[0]];
      const y = def.ops[1] === "r" ? R[a[1]] : a[1];
      let r: number;
      if (def.mn === "ADD") {
        r = x + y;
        m.c = r > 0xff;
      } else if (def.mn === "SUB" || def.mn === "CMP") {
        r = x - y;
        m.c = r < 0;
      } else {
        r = def.mn === "AND" ? x & y : def.mn === "OR" ? x | y : x ^ y;
        m.c = false;
      }
      r &= 0xff;
      setZN(m, r);
      if (def.mn !== "CMP") R[a[0]] = r;
      break;
    }
    case "INC":
      R[a[0]] = (R[a[0]] + 1) & 0xff;
      setZN(m, R[a[0]]);
      break;
    case "DEC":
      R[a[0]] = (R[a[0]] - 1) & 0xff;
      setZN(m, R[a[0]]);
      break;
    case "SHL":
      m.c = (R[a[0]] & 0x80) !== 0;
      R[a[0]] = (R[a[0]] << 1) & 0xff;
      setZN(m, R[a[0]]);
      break;
    case "SHR":
      m.c = (R[a[0]] & 1) !== 0;
      R[a[0]] >>= 1;
      setZN(m, R[a[0]]);
      break;
    case "NOT":
      R[a[0]] = ~R[a[0]] & 0xff;
      setZN(m, R[a[0]]);
      break;
    case "JMP":
      jumpIf(true);
      break;
    case "JZ":
      jumpIf(m.z);
      break;
    case "JNZ":
      jumpIf(!m.z);
      break;
    case "JC":
      jumpIf(m.c);
      break;
    case "JNC":
      jumpIf(!m.c);
      break;
    case "JN":
      jumpIf(m.n);
      break;
    case "PUSH":
      push(R[a[0]]);
      break;
    case "POP":
      R[a[0]] = pop();
      break;
    case "CALL":
      push(m.pc);
      m.pc = a[0];
      break;
    case "RET":
      m.pc = pop();
      break;
    case "OUT":
      m.output += `${R[a[0]]}\n`;
      break;
    case "OUTC":
      m.output += String.fromCharCode(R[a[0]]);
      break;
  }
  if (m.output.length > 4000) m.output = m.output.slice(-4000);
}

// ───────────────────────────── Examples ─────────────────────────────

export const EXAMPLES: { name: string; code: string }[] = [
  {
    name: "Countdown",
    code: `; Count down from 10 to 1
; Watch the Z flag: DEC sets it when A hits 0.

        MOV A, 10
loop:   OUT A
        DEC A
        JNZ loop      ; keep going while A != 0
        HLT
`,
  },
  {
    name: "Hello, World!",
    code: `; Print a zero-terminated string using a pointer

        MOV B, msg    ; B = address of the string
loop:   LD A, [B]     ; A = memory[B]
        CMP A, 0
        JZ done       ; stop at the 0 terminator
        OUTC A
        INC B         ; move to the next character
        JMP loop
done:   HLT

msg:    DB "Hello, World!", '\\n', 0
`,
  },
  {
    name: "Fibonacci",
    code: `; Print every Fibonacci number that fits in 8 bits
; The carry flag tells us when a sum overflows 255.

        MOV A, 0
        MOV B, 1
loop:   OUT A
        MOV C, A
        ADD C, B      ; C = A + B
        JC done       ; overflow? then we're finished
        MOV A, B
        MOV B, C
        JMP loop
done:   OUT B
        HLT
`,
  },
  {
    name: "Multiply (subroutine)",
    code: `; Multiply 6 x 7 using a subroutine
; CALL pushes the return address onto the stack
; (look at the top of memory), and RET pops it.

        MOV A, 6
        MOV B, 7
        CALL mul
        OUT C         ; prints 42
        HLT

; mul: C = A * B, using D as a loop counter
mul:    MOV C, 0
        MOV D, B
        CMP D, 0
        JZ mul_end
mul_lp: ADD C, A
        DEC D
        JNZ mul_lp
mul_end: RET
`,
  },
  {
    name: "Bubble sort",
    code: `; Bubble sort 8 bytes in place, then print them.
; Watch the memory view: green cells are writes.

start:  MOV D, 0      ; D = "swapped" flag
        MOV B, arr    ; B = pointer to arr[i]
        MOV C, 7      ; C = comparisons per pass
inner:  LD A, [B]     ; A = arr[i]
        INC B
        PUSH C        ; free up C for a moment
        LD C, [B]     ; C = arr[i+1]
        CMP C, A      ; borrow (C flag) if arr[i+1] < arr[i]
        JNC noswap
        ST [B], A     ; swap the two elements
        DEC B
        ST [B], C
        INC B
        MOV D, 1
noswap: POP C
        DEC C
        JNZ inner
        CMP D, 0
        JNZ start     ; another pass if anything moved

        MOV B, arr    ; print the sorted array
        MOV C, 8
print:  LD A, [B]
        OUT A
        INC B
        DEC C
        JNZ print
        HLT

arr:    DB 42, 7, 99, 3, 250, 18, 64, 1
`,
  },
];
