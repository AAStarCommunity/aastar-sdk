/**
 * Pure ABI-signature helpers for the upstream radar.
 *
 * Extracted into a SIDE-EFFECT-FREE module so they can be unit-tested (and reused)
 * without importing `upstream-radar.ts`, whose top level runs the full radar (reads
 * files, shells out to git, may run gates) on import. These functions only operate
 * on the data passed to them — importing this module does nothing.
 *
 * They are what lets the radar see PARAM-SHAPE / struct changes (e.g. a factory
 * `InitConfig` tuple gaining `guardianP256X/Y` fields, 6 → 8) that a bare
 * function-name diff is blind to — the v0.20.0 lesson.
 */
import { readFileSync } from "node:fs";

/**
 * Canonical type string for one ABI input, with tuples expanded RECURSIVELY to
 * `(comp,comp,...)` and the array suffix preserved (`[]`, `[3]`). This is what lets
 * the radar see PARAM-SHAPE changes — e.g. a factory `InitConfig` tuple gaining two
 * `bytes32[3]` fields — that a bare function-name diff is blind to (v0.20.0 lesson).
 */
export function canonicalAbiType(input: any): string {
  if (input && typeof input.type === "string" && input.type.startsWith("tuple")) {
    const inner = (input.components || []).map(canonicalAbiType).join(",");
    const suffix = input.type.slice("tuple".length); // "" | "[]" | "[3]" ...
    return `(${inner})${suffix}`;
  }
  return input?.type ?? "";
}

/** Canonical signature `name(type,type,...)` with tuples fully expanded. */
export function abiFunctionSignature(fn: any): string {
  const params = (fn.inputs || []).map(canonicalAbiType).join(",");
  return `${fn.name}(${params})`;
}

/**
 * Map each ABI member keyed as `type:name` -> the set of its canonical signatures
 * (handles overloads). Covers functions, EVENTS, and errors — so a changed event
 * param shape (e.g. `RecoveryProposed` gaining `uint8 guardianIdx`, which moves
 * topic0) is caught too, not just function signatures.
 */
export function abiMemberSignatures(file: string): Map<string, Set<string>> {
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const abi = Array.isArray(raw) ? raw : raw.abi;
  const map = new Map<string, Set<string>>();
  if (Array.isArray(abi)) {
    for (const item of abi) {
      if (
        item &&
        (item.type === "function" || item.type === "event" || item.type === "error") &&
        item.name
      ) {
        const key = `${item.type}:${item.name}`;
        if (!map.has(key)) map.set(key, new Set());
        map.get(key)!.add(abiFunctionSignature(item));
      }
    }
  }
  return map;
}
