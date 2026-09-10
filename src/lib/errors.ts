export class ValidationError extends Error {
  code = "validation_error" as const;
  fields?: Record<string, string[]>;
  raw?: unknown;
  constructor(message: string, opts?: { fields?: Record<string, string[]>; raw?: unknown }) {
    super(message);
    this.name = "ValidationError";
    if (opts) {
      this.fields = opts.fields;
      this.raw = opts.raw;
    }
  }
}

export class SpecDerivationError extends Error {
  code = "spec_derivation_failed" as const;
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "SpecDerivationError";
  }
}

export class MarketplaceError extends Error {
  code = "marketplace_error" as const;
  constructor(message: string) {
    super(message);
    this.name = "MarketplaceError";
  }
}
