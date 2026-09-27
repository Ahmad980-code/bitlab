export type GateType =
  | "INPUT"
  | "OUTPUT"
  | "AND"
  | "OR"
  | "NOT"
  | "NAND"
  | "NOR"
  | "XOR"
  | "XNOR";

export interface CNode {
  id: string;
  type: GateType;
  x: number;
  y: number;
  label?: string;
  value?: boolean;
}

/** A wire from the output of `from` into input pin `pin` of `to`. */
export interface Wire {
  id: string;
  from: string;
  to: string;
  pin: number;
}

export const GATES: GateType[] = ["AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR"];

export const INPUT_COUNT: Record<GateType, number> = {
  INPUT: 0,
  OUTPUT: 1,
  NOT: 1,
  AND: 2,
  OR: 2,
  NAND: 2,
  NOR: 2,
  XOR: 2,
  XNOR: 2,
};

export function inputPinPos(node: CNode, pin: number) {
  const count = INPUT_COUNT[node.type];
  const dy = count === 1 ? 22 : pin === 0 ? 12 : 32;
  return { x: node.x - 14, y: node.y + dy };
}

export function outputPinPos(node: CNode) {
  return { x: node.x + (node.type === "INPUT" ? 58 : 70), y: node.y + 22 };
}

function apply(type: GateType, ins: boolean[]): boolean {
  const [a, b] = ins;
  switch (type) {
    case "OUTPUT":
      return a;
    case "NOT":
      return !a;
    case "AND":
      return a && b;
    case "OR":
      return a || b;
    case "NAND":
      return !(a && b);
    case "NOR":
      return !(a || b);
    case "XOR":
      return a !== b;
    case "XNOR":
      return a === b;
    default:
      return false;
  }
}

/** Maps each node to the node ids driving its input pins (undefined = unconnected). */
function inputSources(nodes: CNode[], wires: Wire[]) {
  const sources = new Map<string, (string | undefined)[]>();
  for (const n of nodes) sources.set(n.id, new Array(INPUT_COUNT[n.type]).fill(undefined));
  for (const w of wires) {
    const pins = sources.get(w.to);
    if (pins && w.pin < pins.length) pins[w.pin] = w.from;
  }
  return sources;
}

/**
 * Evaluates the circuit by relaxing gate outputs until they stop changing.
 * Seeding with the previous values lets feedback circuits (latches) keep their state.
 * For OUTPUT nodes the value is the signal arriving at the LED.
 */
export function simulate(
  nodes: CNode[],
  wires: Wire[],
  seed: Record<string, boolean> = {},
  overrides: Record<string, boolean> = {},
): { values: Record<string, boolean>; stable: boolean } {
  const sources = inputSources(nodes, wires);
  const values: Record<string, boolean> = {};
  for (const n of nodes) {
    values[n.id] =
      n.type === "INPUT" ? (overrides[n.id] ?? n.value ?? false) : (seed[n.id] ?? false);
  }
  for (let iter = 0; iter < 64; iter++) {
    let changed = false;
    for (const n of nodes) {
      if (n.type === "INPUT") continue;
      const ins = sources.get(n.id)!.map((src) => (src ? values[src] : false));
      const v = apply(n.type, ins);
      if (v !== values[n.id]) {
        values[n.id] = v;
        changed = true;
      }
    }
    if (!changed) return { values, stable: true };
  }
  return { values, stable: false };
}

const SYMBOL: Partial<Record<GateType, string>> = {
  AND: "·",
  OR: "+",
  XOR: "⊕",
  NAND: "·",
  NOR: "+",
  XNOR: "⊕",
};

/** Builds a Boolean expression for the signal feeding `nodeId`. */
export function expression(nodes: CNode[], wires: Wire[], nodeId: string): string {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const sources = inputSources(nodes, wires);

  const walk = (id: string | undefined, visiting: Set<string>, top: boolean): string => {
    if (!id) return "0";
    const n = byId.get(id)!;
    if (n.type === "INPUT") return n.label ?? "?";
    if (visiting.has(id)) return "↺";
    const next = new Set(visiting).add(id);
    const pins = sources.get(id)!;
    if (n.type === "OUTPUT") return walk(pins[0], next, true);
    if (n.type === "NOT") {
      const inner = walk(pins[0], next, false);
      return `¬${inner}`;
    }
    const inner = pins.map((p) => walk(p, next, false)).join(` ${SYMBOL[n.type]} `);
    if (n.type === "NAND" || n.type === "NOR" || n.type === "XNOR") return `¬(${inner})`;
    return top ? inner : `(${inner})`;
  };

  return walk(nodeId, new Set(), true);
}

export interface Preset {
  name: string;
  description: string;
  nodes: CNode[];
  wires: [from: string, to: string, pin: number][];
}

export const PRESETS: Preset[] = [
  {
    name: "Half adder",
    description: "Adds two bits. XOR gives the sum, AND gives the carry.",
    nodes: [
      { id: "a", type: "INPUT", x: 80, y: 120, label: "A" },
      { id: "b", type: "INPUT", x: 80, y: 280, label: "B" },
      { id: "x", type: "XOR", x: 320, y: 110 },
      { id: "n", type: "AND", x: 320, y: 270 },
      { id: "s", type: "OUTPUT", x: 560, y: 110, label: "S" },
      { id: "c", type: "OUTPUT", x: 560, y: 270, label: "C" },
    ],
    wires: [
      ["a", "x", 0],
      ["b", "x", 1],
      ["a", "n", 0],
      ["b", "n", 1],
      ["x", "s", 0],
      ["n", "c", 0],
    ],
  },
  {
    name: "Full adder",
    description: "Adds A + B + carry-in. Chain these to build an n-bit adder.",
    nodes: [
      { id: "a", type: "INPUT", x: 60, y: 80, label: "A" },
      { id: "b", type: "INPUT", x: 60, y: 200, label: "B" },
      { id: "ci", type: "INPUT", x: 60, y: 360, label: "Cin" },
      { id: "x1", type: "XOR", x: 240, y: 100 },
      { id: "x2", type: "XOR", x: 460, y: 120 },
      { id: "a1", type: "AND", x: 240, y: 240 },
      { id: "a2", type: "AND", x: 460, y: 300 },
      { id: "o", type: "OR", x: 660, y: 260 },
      { id: "s", type: "OUTPUT", x: 860, y: 120, label: "S" },
      { id: "co", type: "OUTPUT", x: 860, y: 260, label: "Cout" },
    ],
    wires: [
      ["a", "x1", 0],
      ["b", "x1", 1],
      ["x1", "x2", 0],
      ["ci", "x2", 1],
      ["a", "a1", 0],
      ["b", "a1", 1],
      ["x1", "a2", 0],
      ["ci", "a2", 1],
      ["a1", "o", 0],
      ["a2", "o", 1],
      ["x2", "s", 0],
      ["o", "co", 0],
    ],
  },
  {
    name: "SR latch",
    description: "Two cross-coupled NOR gates: a 1-bit memory. Pulse S to set, R to reset.",
    nodes: [
      { id: "r", type: "INPUT", x: 80, y: 110, label: "R" },
      { id: "s", type: "INPUT", x: 80, y: 310, label: "S" },
      { id: "n1", type: "NOR", x: 340, y: 120 },
      { id: "n2", type: "NOR", x: 340, y: 300 },
      { id: "q", type: "OUTPUT", x: 600, y: 120, label: "Q" },
      { id: "qn", type: "OUTPUT", x: 600, y: 300, label: "Q̄" },
    ],
    wires: [
      ["r", "n1", 0],
      ["n2", "n1", 1],
      ["n1", "n2", 0],
      ["s", "n2", 1],
      ["n1", "q", 0],
      ["n2", "qn", 0],
    ],
  },
  {
    name: "2:1 multiplexer",
    description: "SEL chooses which input reaches Y. It's the building block of data paths.",
    nodes: [
      { id: "a", type: "INPUT", x: 60, y: 80, label: "A" },
      { id: "b", type: "INPUT", x: 60, y: 230, label: "B" },
      { id: "sel", type: "INPUT", x: 60, y: 390, label: "SEL" },
      { id: "inv", type: "NOT", x: 230, y: 390 },
      { id: "g1", type: "AND", x: 420, y: 100 },
      { id: "g2", type: "AND", x: 420, y: 260 },
      { id: "o", type: "OR", x: 620, y: 180 },
      { id: "y", type: "OUTPUT", x: 820, y: 180, label: "Y" },
    ],
    wires: [
      ["sel", "inv", 0],
      ["a", "g1", 0],
      ["inv", "g1", 1],
      ["b", "g2", 0],
      ["sel", "g2", 1],
      ["g1", "o", 0],
      ["g2", "o", 1],
      ["o", "y", 0],
    ],
  },
  { name: "Blank board", description: "Start from scratch.", nodes: [], wires: [] },
];
