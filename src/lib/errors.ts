export class ValidationError extends Error {
  code = "validation_error" as const;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
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

export class AuthError extends Error {
  code = "auth_error" as const;
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
