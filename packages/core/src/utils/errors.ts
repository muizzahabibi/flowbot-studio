export class FlowError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly details?: unknown,
    public readonly endpoint?: string,
  ) {
    super(message);
    this.name = 'FlowError';
  }
}

export class FlowAuthError extends FlowError {
  constructor(message: string, details?: unknown) {
    super(message, 401, details, 'auth/session');
    this.name = 'FlowAuthError';
  }
}

export class FlowValidationError extends FlowError {
  constructor(message: string, details?: unknown) {
    super(message, 400, details);
    this.name = 'FlowValidationError';
  }
}

export class FlowRetryExhaustedError extends FlowError {
  constructor(message: string, details?: unknown, endpoint?: string) {
    super(message, 503, details, endpoint);
    this.name = 'FlowRetryExhaustedError';
  }
}
