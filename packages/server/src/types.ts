export interface ServerConfig {
  apiKey?: string;
}

export interface ErrorBody {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}
