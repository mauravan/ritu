import { parseRequirementValue } from "./parseRequirementValue";
import type { DerivedSpec, RawProduct } from "./types";

function extractAllNumericFromText(
  text: string,
): { value: number; unit?: string; index: number }[] {
  const results: { value: number; unit?: string; index: number }[] = [];
  const regex = /([\d.,]+)\s*([a-zA-Z%]+)?/g;
  let match = regex.exec(text);
  while (match !== null) {
    const numStr = (match[1] ?? "").replace(/,/g, ".");
    const num = parseFloat(numStr);
    if (!Number.isNaN(num)) {
      const unit = match[2] || undefined;
      results.push({ value: num, unit, index: match.index });
    }
    match = regex.exec(text);
  }
  return results;
}

function findBestNumeric(
  extractions: { value: number; unit?: string; index: number }[],
  specValue: number,
  specUnit?: string,
  operator?: ">=" | "<=" | "=" | ">" | "<",
): { value: number; unit?: string } | null {
  if (extractions.length === 0) return null;
  const withUnit = extractions.filter(
    (e) => specUnit !== undefined && e.unit && e.unit.toLowerCase() === specUnit.toLowerCase(),
  );
  const candidates = withUnit.length > 0 ? withUnit : extractions;
  if (!operator || operator === "=") {
    const best = candidates.reduce((prev, curr) =>
      Math.abs(curr.value - specValue) < Math.abs(prev.value - specValue) ? curr : prev,
    );
    return { value: best.value, unit: best.unit || undefined };
  }
  if (operator === ">=" || operator === ">") {
    const above = candidates.filter((c) => c.value >= specValue);
    const pool = above.length > 0 ? above : candidates;
    const best = pool.reduce((prev, curr) =>
      Math.abs(curr.value - specValue) < Math.abs(prev.value - specValue) ? curr : prev,
    );
    return { value: best.value, unit: best.unit || undefined };
  }
  if (operator === "<=" || operator === "<") {
    const below = candidates.filter((c) => c.value <= specValue);
    const pool = below.length > 0 ? below : candidates;
    const best = pool.reduce((prev, curr) =>
      Math.abs(curr.value - specValue) < Math.abs(prev.value - specValue) ? curr : prev,
    );
    return { value: best.value, unit: best.unit || undefined };
  }
  const best = candidates.reduce((prev, curr) =>
    Math.abs(curr.value - specValue) < Math.abs(prev.value - specValue) ? curr : prev,
  );
  return { value: best.value, unit: best.unit || undefined };
}

function compareNumeric(
  productValue: number,
  operator: ">=" | "<=" | "=" | ">" | "<",
  requiredValue: number,
  specUnit?: string,
  productUnit?: string,
): boolean {
  if (specUnit && productUnit) {
    if (specUnit.toLowerCase() !== productUnit.toLowerCase()) {
      return false;
    }
  }
  switch (operator) {
    case ">=":
      return productValue >= requiredValue;
    case "<=":
      return productValue <= requiredValue;
    case "=":
      return Math.abs(productValue - requiredValue) < 0.001;
    case ">":
      return productValue > requiredValue;
    case "<":
      return productValue < requiredValue;
  }
  return false;
}

export function applyNumericFilter(
  products: RawProduct[],
  spec: DerivedSpec,
): { included: RawProduct[]; penalties: Map<string, number> } {
  const penalties = new Map<string, number>();
  const includedIds = new Set<string>();
  for (const p of products) {
    let productExcluded = false;
    for (const req of spec.requirements) {
      const parsed = parseRequirementValue(req.value);
      if (parsed.compoundOptions && parsed.compoundOptions.length > 1) continue;
      if (parsed.numericValue === 0) continue;
      // Skip GPU requirements handled by signal registry (comparative ranking, not numeric exclusion)
      if (/\b(gtx|rtx)\b/i.test(req.value) && /\b\d{3,4}\b/.test(req.value)) continue;
      const rawText =
        typeof p.raw === "string"
          ? p.raw
          : typeof p.raw === "object" && p.raw !== null
            ? JSON.stringify(p.raw)
            : "";
      const textToSearch = `${p.title} ${rawText}`.toLowerCase();
      const extractions = extractAllNumericFromText(textToSearch);
      const best = findBestNumeric(extractions, parsed.numericValue, parsed.unit, parsed.operator);
      if (best === null) {
        penalties.set(
          p.id,
          (penalties.get(p.id) ?? 0) + (req.importance === "required" ? -15 : -10),
        );
        continue;
      }
      const passes = compareNumeric(
        best.value,
        parsed.operator,
        parsed.numericValue,
        parsed.unit,
        best.unit,
      );
      if (!passes) {
        if (req.importance === "required") {
          productExcluded = true;
        } else {
          penalties.set(p.id, (penalties.get(p.id) ?? 0) - 15);
        }
      } else {
        if (req.importance === "required") {
          penalties.set(p.id, (penalties.get(p.id) ?? 0) + 5);
        }
      }
    }
    if (!productExcluded) includedIds.add(p.id);
  }
  const included = products.filter((p) => includedIds.has(p.id));
  return { included, penalties };
}
