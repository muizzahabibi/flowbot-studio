export type FlowErrorCode = 'FLOW_AUTH_REFRESH_NEEDED' | 'FLOW_AUTH_INVALID_COOKIE' | (string & {});

export type FlowErrorSource = 'auth_session' | (string & {});

export interface FlowErrorOptions {
  code?: FlowErrorCode;
  statusCode?: number;
  details?: unknown;
  endpoint?: string;
  source?: FlowErrorSource;
  retryable?: boolean;
}

export interface FlowAuthErrorOptions extends Omit<FlowErrorOptions, 'statusCode' | 'endpoint' | 'source'> {
  statusCode?: 401;
  endpoint?: 'auth/session';
  source?: 'auth_session';
}

export class FlowError extends Error {
  public readonly code?: FlowErrorCode;
  public readonly statusCode?: number;
  public readonly details?: unknown;
  public readonly endpoint?: string;
  public readonly source?: FlowErrorSource;
  public readonly retryable?: boolean;

  constructor(message: string, options?: FlowErrorOptions);
  constructor(message: string, statusCode?: number, details?: unknown, endpoint?: string);
  constructor(
    message: string,
    optionsOrStatusCode: FlowErrorOptions | number = {},
    legacyDetails?: unknown,
    legacyEndpoint?: string,
  ) {
    super(message);
    this.name = 'FlowError';

    const options = normalizeFlowErrorOptions(optionsOrStatusCode, legacyDetails, legacyEndpoint);

    if (options.code !== undefined) {
      this.code = options.code;
    }
    if (options.statusCode !== undefined) {
      this.statusCode = options.statusCode;
    }
    if (options.details !== undefined) {
      this.details = options.details;
    }
    if (options.endpoint !== undefined) {
      this.endpoint = options.endpoint;
    }
    if (options.source !== undefined) {
      this.source = options.source;
    }
    if (options.retryable !== undefined) {
      this.retryable = options.retryable;
    }
  }
}

function normalizeFlowErrorOptions(
  optionsOrStatusCode: FlowErrorOptions | number,
  legacyDetails?: unknown,
  legacyEndpoint?: string,
): FlowErrorOptions {
  if (typeof optionsOrStatusCode !== 'number') {
    return optionsOrStatusCode;
  }

  const options: FlowErrorOptions = {
    statusCode: optionsOrStatusCode,
  };

  if (legacyDetails !== undefined) {
    options.details = legacyDetails;
  }
  if (legacyEndpoint !== undefined) {
    options.endpoint = legacyEndpoint;
  }

  return options;
}

export class FlowAuthError extends FlowError {
  constructor(message: string, options: FlowAuthErrorOptions = {}) {
    super(message, {
      statusCode: 401,
      endpoint: 'auth/session',
      source: 'auth_session',
      ...options,
    });
    this.name = 'FlowAuthError';
  }
}

export class FlowValidationError extends FlowError {
  constructor(message: string, details?: unknown) {
    super(message, { statusCode: 400, details });
    this.name = 'FlowValidationError';
  }
}

export class FlowRetryExhaustedError extends FlowError {
  constructor(message: string, details?: unknown, endpoint?: string) {
    const options: FlowErrorOptions = { statusCode: 503 };
    if (details !== undefined) {
      options.details = details;
    }
    if (endpoint !== undefined) {
      options.endpoint = endpoint;
    }

    super(message, options);
    this.name = 'FlowRetryExhaustedError';
  }
}
