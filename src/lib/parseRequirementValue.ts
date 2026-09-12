export interface ParsedRequirementValue {
  operator: ">=" | "<=" | "=" | ">" | "<";
  numericValue: number;
  unit?: string;
  compoundOptions?: string[]; // for compound OR requirements
}

export function parseRequirementValue(value: string): ParsedRequirementValue {
  const trimmed = value.trim();
  // Compound / OR split
  const compoundOptions = trimmed
    .split(/\s+or\s+|\/|\s*;\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const hasCompound = compoundOptions.length > 1;

  // Try parsing each segment; default to first for numeric extraction
  const firstText = compoundOptions[0] ?? trimmed;
  return parseSingleRequirementValue(firstText, hasCompound ? compoundOptions : undefined);
}

export function parseSingleRequirementValue(
  value: string,
  compoundOptions?: string[],
): ParsedRequirementValue {
  // Detect compound OR
  if (compoundOptions && compoundOptions.length > 1) {
    return { operator: "=", numericValue: 0, unit: undefined, compoundOptions };
  }

  // Numeric parser for ranges/min/max
  const atLeastMatch = value.match(/at\s+least\s+([\d.,]+)\s*([a-zA-Z%]+)?/i);
  if (atLeastMatch) {
    return {
      operator: ">=",
      numericValue: parseNumeric(atLeastMatch[1]!),
      unit: atLeastMatch[2] || undefined,
    };
  }

  const maxMatch = value.match(/(?:maximum|max|up\s+to)\s+([\d.,]+)\s*([a-zA-Z%]+)?/i);
  if (maxMatch) {
    return {
      operator: "<=",
      numericValue: parseNumeric(maxMatch[1]!),
      unit: maxMatch[2] || undefined,
    };
  }

  const minMatch = value.match(/(?:minimum|min)\s+([\d.,]+)\s*([a-zA-Z%]+)?/i);
  if (minMatch) {
    return {
      operator: ">=",
      numericValue: parseNumeric(minMatch[1]!),
      unit: minMatch[2] || undefined,
    };
  }

  const greaterEqualMatch = value.match(
    /(?:^|\s)([\d.,]+)(?:\+)?(?:\s*([a-zA-Z%]+))?(?:\+)?(?:$|\s)/,
  );
  if (greaterEqualMatch) {
    const numStr = greaterEqualMatch[1]!;
    const restUnit = greaterEqualMatch[2] || undefined;
    const plusMatch = value.match(/([\d.,]+\s*[a-zA-Z%]*)(\+)/) || value.match(/([\d.,]+)(\+)/);
    const hasPlusPrecise = !!plusMatch;
    return {
      operator: hasPlusPrecise ? ">=" : "=",
      numericValue: parseNumeric(numStr),
      unit: restUnit || extractUnit(value),
    };
  }

  const numericMatch = value.match(/(?<![a-zA-Z])([\d.,]+)\s*([a-zA-Z%]+)?/);
  if (numericMatch) {
    return {
      operator: "=",
      numericValue: parseNumeric(numericMatch[1]!),
      unit: numericMatch[2] || extractUnit(value),
    };
  }

  // No numeric value found; treat as compound keyword match (e.g. CPU names)
  return {
    operator: "=",
    numericValue: 0,
    unit: undefined,
    compoundOptions: compoundOptions,
  };
}

function parseNumeric(str: string): number {
  // If commas separate thousands (e.g. 1,000 or 1,000,000) remove them; else treat as decimal
  if (/,/.test(str)) {
    const parts = str.split(",");
    const lastPart = parts[parts.length - 1] ?? "";
    if (lastPart.length === 3 && /^[0-9]+$/.test(lastPart) && parts.length > 1) {
      return parseFloat(str.replace(/,/g, ""));
    }
  }
  const cleaned = str.replace(/,/g, ".");
  return parseFloat(cleaned);
}

function extractUnit(text: string): string | undefined {
  const units = [
    "GB",
    "TB",
    "MB",
    "kb",
    "kb/s",
    "kg",
    "g",
    "lb",
    "cm",
    "mm",
    "inch",
    "in",
    "m",
    "w",
    "hz",
    "ghz",
    "mhz",
  ];
  for (const u of units) {
    if (text.toLowerCase().includes(u.toLowerCase())) return u;
  }
  return undefined;
}
