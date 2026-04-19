/**
 * Pricing & production math for Bosgoedt.
 *
 * This module is the single source of truth for:
 *   - how many recipe-batches an order translates to,
 *   - how much of each ingredient is needed,
 *   - what a customer pays for a line, including tiered prices, weekly
 *     offering overrides, group discounts and personal customer discounts.
 *
 * The functions here are pure — callers fetch data from Supabase once and
 * pass it in. That way Production, StockCheck, FinancialOverview, the
 * customer order flow and the baker order dialog all reach the same answer
 * for the same inputs.
 *
 * Key mental model — "recipe yield" vs "sell unit":
 *   - `recipe_yield_quantity` + `recipe_yield_unit` = how much one batch of
 *     the recipe produces (e.g. 1 kg granola, 24 cookies).
 *   - `sell_unit_quantity`    + `sell_unit_unit`    = how the product is
 *     offered to customers (e.g. per 400 g, per stuk).
 *
 *   Ordered units (N) → base volume that needs to be produced:
 *     produced_base = N × sell_unit_qty (in dimension base)
 *     batches       = produced_base / recipe_yield_qty (in dimension base)
 *     ingredient_i  = recipe_ingredient_i.quantity × batches
 *
 *   The sell unit and recipe yield unit must share a dimension (both mass,
 *   both volume, or both count). Mismatch → bug in product setup.
 */
import { toBase, isCompatible, type MeasurementUnit } from "./units";

// ---------------------------------------------------------------------------
// Product / pricing inputs
// ---------------------------------------------------------------------------

/** Minimum product fields pricing/production need. Purposely narrow. */
export interface ProductForPricing {
  id: string;
  selling_price: number;
  recipe_yield_quantity: number;
  recipe_yield_unit: MeasurementUnit;
  sell_unit_quantity: number;
  sell_unit_unit: MeasurementUnit;
}

/** A volume-based price tier for one product (e.g. "10+ stuks = € 0,80"). */
export interface ProductPriceTier {
  min_quantity: number;
  price: number;
}

/** A tier in a cross-product discount group (e.g. "5+ items = 10% off"). */
export interface DiscountGroupTier {
  min_quantity: number;
  discount_percentage: number;
}

/** A discount group applies a % tier to every product that belongs to it. */
export interface DiscountGroupForPricing {
  id: string;
  product_ids: string[];
  tiers: DiscountGroupTier[];
}

/** Optional weekly override of a product's base selling price. */
export interface WeeklyOfferingForPricing {
  product_id: string;
  price_override: number | null;
}

/** One line in an order: which product and how many sell-units were ordered. */
export interface OrderLine {
  product_id: string;
  quantity: number;
}

/** A recipe ingredient row — quantity is expressed in `unit` per *one batch*. */
export interface RecipeIngredient {
  ingredient_id: string;
  quantity: number;
  unit: MeasurementUnit;
}

// ---------------------------------------------------------------------------
// Production math
// ---------------------------------------------------------------------------

/**
 * How many recipe-batches `orderedUnits` sell-units translate to.
 *
 * Throws if the product's recipe-yield unit and sell-unit are in different
 * dimensions — that's a product-setup error we want surfaced, not silently
 * divided-by-zero-away.
 */
export function batchesForOrder(
  product: ProductForPricing,
  orderedUnits: number,
): number {
  if (!isCompatible(product.recipe_yield_unit, product.sell_unit_unit)) {
    throw new Error(
      `Product ${product.id}: recipe_yield_unit (${product.recipe_yield_unit}) ` +
        `and sell_unit_unit (${product.sell_unit_unit}) are not in the same ` +
        `dimension — cannot compute batches.`,
    );
  }
  if (product.recipe_yield_quantity <= 0) return 0;

  const producedBase = orderedUnits * toBase(product.sell_unit_quantity, product.sell_unit_unit);
  const recipeBase = toBase(product.recipe_yield_quantity, product.recipe_yield_unit);
  return producedBase / recipeBase;
}

/**
 * Scale a single recipe ingredient to the number of batches produced.
 * Returns the amount needed, expressed in the ingredient's own unit.
 */
export function ingredientNeeded(
  recipeIngredient: Pick<RecipeIngredient, "quantity">,
  batches: number,
): number {
  return recipeIngredient.quantity * batches;
}

// ---------------------------------------------------------------------------
// Per-line pricing
// ---------------------------------------------------------------------------

/**
 * Pick the applicable per-unit price for a given quantity.
 *
 * Resolution order:
 *   1. Weekly offering override  (if present) — replaces base price.
 *   2. Product price tiers       — highest tier whose min_quantity ≤ quantity
 *                                  wins (tiers are volume-based discounts).
 *   3. `product.selling_price`   — fallback.
 *
 * Price tiers never apply on top of an override; we assume a weekly override
 * is the baker's explicit "this week, flat price" decision.
 */
export function unitPriceFor(
  product: ProductForPricing,
  quantity: number,
  ctx: {
    offering?: WeeklyOfferingForPricing | null;
    priceTiers?: ProductPriceTier[];
  } = {},
): number {
  const override = ctx.offering?.price_override;
  if (override != null) return override;

  const tiers = ctx.priceTiers ?? [];
  if (tiers.length > 0 && quantity > 0) {
    // Find the highest-threshold tier that still applies.
    const applicable = [...tiers]
      .filter((t) => quantity >= t.min_quantity)
      .sort((a, b) => b.min_quantity - a.min_quantity)[0];
    if (applicable) return applicable.price;
  }

  return product.selling_price;
}

// ---------------------------------------------------------------------------
// Order totals (full breakdown)
// ---------------------------------------------------------------------------

export interface OrderLineBreakdown {
  product_id: string;
  quantity: number;
  unit_price: number;
  line_subtotal: number;            // quantity × unit_price
  group_discount_amount: number;    // share of group-tier discount assigned to this line
  customer_discount_amount: number; // share of personal customer discount
  line_total: number;               // line_subtotal − group − customer
}

export interface OrderBreakdown {
  lines: OrderLineBreakdown[];
  subtotal: number;
  group_discount_amount: number;
  customer_discount_amount: number;
  discount_amount: number; // group + customer
  total: number;
}

export interface ComputeOrderTotalsInput {
  lines: OrderLine[];
  products: ProductForPricing[];
  /** Optional: maps product_id → priceTiers for that product. */
  priceTiersByProductId?: Record<string, ProductPriceTier[]>;
  /** Optional: one offering per product_id for the relevant week. */
  offeringsByProductId?: Record<string, WeeklyOfferingForPricing>;
  /** Groups whose tiers apply if enough units across member products ordered. */
  discountGroups?: DiscountGroupForPricing[];
  /** Customer's personal discount (0-100). Applied *after* group discounts. */
  customerDiscountPercentage?: number;
}

/**
 * Full per-line and total breakdown for an order. Handles:
 *   - resolving the right unit price per line (override → tier → base),
 *   - computing group discounts across member lines,
 *   - applying the customer's personal discount on top,
 *   - splitting both discount amounts back onto each line proportionally so
 *     the UI can show a per-line total that sums back to the overall total.
 *
 * Rounding: the returned numbers are not pre-rounded. Callers that store to
 * Supabase (`numeric` columns) should round to 2 decimals themselves where
 * it matters.
 */
export function computeOrderTotals(input: ComputeOrderTotalsInput): OrderBreakdown {
  const {
    lines,
    products,
    priceTiersByProductId = {},
    offeringsByProductId = {},
    discountGroups = [],
    customerDiscountPercentage = 0,
  } = input;

  const productById = new Map(products.map((p) => [p.id, p]));

  // --- 1. Per-line subtotals (before any discount). ---
  const lineItems: Array<
    OrderLineBreakdown & { product: ProductForPricing | undefined }
  > = lines.map((line) => {
    const product = productById.get(line.product_id);
    const unit_price = product
      ? unitPriceFor(product, line.quantity, {
          offering: offeringsByProductId[line.product_id],
          priceTiers: priceTiersByProductId[line.product_id],
        })
      : 0;
    const line_subtotal = unit_price * line.quantity;
    return {
      product,
      product_id: line.product_id,
      quantity: line.quantity,
      unit_price,
      line_subtotal,
      group_discount_amount: 0,
      customer_discount_amount: 0,
      line_total: line_subtotal,
    };
  });

  const subtotal = lineItems.reduce((acc, l) => acc + l.line_subtotal, 0);

  // --- 2. Group discounts — cross-line, tier-based. ---
  let groupDiscountTotal = 0;
  for (const group of discountGroups) {
    const memberLines = lineItems.filter((l) => group.product_ids.includes(l.product_id));
    if (memberLines.length === 0) continue;

    const totalQty = memberLines.reduce((acc, l) => acc + l.quantity, 0);
    const groupValue = memberLines.reduce((acc, l) => acc + l.line_subtotal, 0);
    if (totalQty <= 0 || groupValue <= 0) continue;

    // Highest-threshold tier whose min_quantity ≤ total ordered qty wins.
    const applicable = [...group.tiers]
      .filter((t) => totalQty >= t.min_quantity)
      .sort((a, b) => b.min_quantity - a.min_quantity)[0];
    if (!applicable) continue;

    const groupDiscount = groupValue * (applicable.discount_percentage / 100);
    groupDiscountTotal += groupDiscount;

    // Spread the group discount proportionally across member lines so per-line
    // totals still add up correctly.
    for (const line of memberLines) {
      const share = line.line_subtotal / groupValue;
      line.group_discount_amount += groupDiscount * share;
    }
  }

  // --- 3. Customer discount — applied on the amount after group discounts. ---
  const afterGroupDiscount = subtotal - groupDiscountTotal;
  const customerDiscountTotal =
    afterGroupDiscount * (Math.max(0, customerDiscountPercentage) / 100);

  if (afterGroupDiscount > 0) {
    for (const line of lineItems) {
      const postGroup = line.line_subtotal - line.group_discount_amount;
      if (postGroup <= 0) continue;
      const share = postGroup / afterGroupDiscount;
      line.customer_discount_amount += customerDiscountTotal * share;
    }
  }

  // --- 4. Finalize per-line totals. ---
  for (const line of lineItems) {
    line.line_total =
      line.line_subtotal - line.group_discount_amount - line.customer_discount_amount;
  }

  const discount_amount = groupDiscountTotal + customerDiscountTotal;

  return {
    lines: lineItems.map(({ product: _product, ...rest }) => rest),
    subtotal,
    group_discount_amount: groupDiscountTotal,
    customer_discount_amount: customerDiscountTotal,
    discount_amount,
    total: subtotal - discount_amount,
  };
}

// ---------------------------------------------------------------------------
// Aggregate ingredient/fixed-cost needs (for Production & StockCheck)
// ---------------------------------------------------------------------------

export interface BatchedRecipe {
  product_id: string;
  batches: number;
}

/**
 * Given an order's lines + the relevant products, compute batches per product.
 * Handy shorthand for Production / StockCheck that don't care about pricing.
 */
export function batchesPerProduct(
  lines: OrderLine[],
  products: ProductForPricing[],
): BatchedRecipe[] {
  const productById = new Map(products.map((p) => [p.id, p]));
  // Sum quantities per product first — one customer may have two lines for
  // the same product (unlikely, but defensive).
  const qtyByProduct = new Map<string, number>();
  for (const line of lines) {
    qtyByProduct.set(
      line.product_id,
      (qtyByProduct.get(line.product_id) ?? 0) + line.quantity,
    );
  }
  const result: BatchedRecipe[] = [];
  for (const [product_id, quantity] of qtyByProduct) {
    const product = productById.get(product_id);
    if (!product) continue;
    result.push({ product_id, batches: batchesForOrder(product, quantity) });
  }
  return result;
}
