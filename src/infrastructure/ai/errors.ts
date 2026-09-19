/** The AI provider was reachable but never produced schema-valid output (§65). */
export class AIStructuredError extends Error {
  constructor(
    message: string,
    readonly lastRaw: string,
    readonly validationError: string,
  ) {
    super(message);
    this.name = "AIStructuredError";
  }
}

/** The AI provider could not be reached / returned an error (network, quota). */
export class AIProviderError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "AIProviderError";
  }
}
