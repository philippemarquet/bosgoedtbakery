/**
 * Unit conversions for the bakery's `measurement_unit` enum.
 *
 * Every unit belongs to exactly one `Dimension` (mass, volume, count, time,
 * spoon). Units in the same dimension are convertible via a shared base unit;
 * units in different dimensions are not.
 *
 * This module is the single source of truth for unit math — other modules
 * (pricing, production, stock-check) should not re-implement conversions.
 */
import type { Database } from "@/integrations/supabase/types";

export type MeasurementUnit = Database["public"]["Enums"]["measurement_unit"];

export type Dimension = "mass" | "volume" | "count" | "time" | "spoon";

/**
 * Every unit mapped to its dimension and factor-to-base.
 *
 * Base per dimension:
 *   mass    → gram
 *   volume  → ml
 *   count   → stuks
 *   time    → uur
 *   spoon   → eetlepel
 *
 * `factorToBase` is the number of base-units in one of this unit, so
 *   quantity_in_base = quantity × factorToBase.
 */
const UNIT_INFO: Record<
  MeasurementUnit,
  { dimension: Dimension; factorToBase: number }
> = {
  kg:       { dimension: "mass",   factorToBase: 1000 },
  gram:     { dimension: "mass",   factorToBase: 1 },
  liter:    { dimension: "volume", factorToBase: 1000 },
  ml:       { dimension: "volume", factorToBase: 1 },
  stuks:    { dimension: "count",  factorToBase: 1 },
  uur:      { dimension: "time",   factorToBase: 1 },
  eetlepel: { dimension: "spoon",  factorToBase: 1 },
};

/** Human-readable Dutch labels (used in dropdowns/summaries). */
export const UNIT_LABELS: Record<MeasurementUnit, string> = {
  kg: "kilogram",
  gram: "gram",
  liter: "liter",
  ml: "milliliter",
  stuks: "stuks",
  uur: "uur",
  eetlepel: "eetlepel",
};

/** Short labels used in tight UI (e.g. "400 g", "2 kg"). */
export const UNIT_LABELS_SHORT: Record<MeasurementUnit, string> = {
  kg: "kg",
  gram: "g",
  liter: "l",
  ml: "ml",
  stuks: "stuks",
  uur: "u",
  eetlepel: "el",
};

/** Options suitable for a `<Select>` — preserves the enum order. */
export const UNIT_OPTIONS: ReadonlyArray<{ value: MeasurementUnit; label: string }> = [
  { value: "kg", label: "Kilogram (kg)" },
  { value: "gram", label: "Gram (g)" },
  { value: "liter", label: "Liter (l)" },
  { value: "ml", label: "Milliliter (ml)" },
  { value: "stuks", label: "Stuks" },
  { value: "uur", label: "Uur" },
  { value: "eetlepel", label: "Eetlepel" },
];

// ---------------------------------------------------------------------------
// Core conversions
// ---------------------------------------------------------------------------

/** Dimension of a unit. */
export function getDimension(unit: MeasurementUnit): Dimension {
  return UNIT_INFO[unit].dimension;
}

/** True if two units share a dimension (and are therefore convertible). */
export function isCompatible(a: MeasurementUnit, b: MeasurementUnit): boolean {
  return UNIT_INFO[a].dimension === UNIT_INFO[b].dimension;
}

/** Quantity expressed in the dimension's base unit. */
export function toBase(quantity: number, unit: MeasurementUnit): number {
  return quantity * UNIT_INFO[unit].factorToBase;
}

/** Quantity converted from the dimension's base unit to `unit`. */
export function fromBase(baseQuantity: number, unit: MeasurementUnit): number {
  return baseQuantity / UNIT_INFO[unit].factorToBase;
}

/**
 * Convert a quantity from one unit to another. Throws if the units belong to
 * different dimensions (converting kg → liter is a data-modeling bug).
 */
export function convert(
  quantity: number,
  from: MeasurementUnit,
  to: MeasurementUnit,
): number {
  if (!isCompatible(from, to)) {
    throw new Error(
      `Cannot convert ${UNIT_LABELS[from]} to ${UNIT_LABELS[to]} — incompatible dimensions.`,
    );
  }
  if (from === to) return quantity;
  return fromBase(toBase(quantity, from), to);
}

/** Soft variant of `convert` — returns `null` instead of throwing on mismatch. */
export function tryConvert(
  quantity: number,
  from: MeasurementUnit,
  to: MeasurementUnit,
): number | null {
  if (!isCompatible(from, to)) return null;
  if (from === to) return quantity;
  return fromBase(toBase(quantity, from), to);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Pick a sensible display unit for showing a quantity to a human:
 *   mass  → kg if ≥ 1000 gram, else gram
 *   volume→ liter if ≥ 1000 ml, else ml
 *   other → the unit itself
 */
export function preferredDisplayUnit(
  quantity: number,
  unit: MeasurementUnit,
): MeasurementUnit {
  const dim = getDimension(unit);
  const inBase = toBase(quantity, unit);
  if (dim === "mass") return Math.abs(inBase) >= 1000 ? "kg" : "gram";
  if (dim === "volume") return Math.abs(inBase) >= 1000 ? "liter" : "ml";
  return unit;
}

/**
 * Format a quantity + unit for humans, e.g. `formatQuantity(1500, "gram") → "1,5 kg"`.
 * Uses Dutch decimal-comma formatting and the short unit labels.
 */
export function formatQuantity(
  quantity: number,
  unit: MeasurementUnit,
  opts: { smart?: boolean; maxFractionDigits?: number } = {},
): string {
  const { smart = true, maxFractionDigits = 1 } = opts;
  const targetUnit = smart ? preferredDisplayUnit(quantity, unit) : unit;
  const value = smart && targetUnit !== unit ? convert(quantity, unit, targetUnit) : quantity;
  const formatted = new Intl.NumberFormat("nl-NL", {
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
  return `${formatted} ${UNIT_LABELS_SHORT[targetUnit]}`;
}
