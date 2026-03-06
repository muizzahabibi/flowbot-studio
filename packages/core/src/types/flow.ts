export type TelemetryMode = 'enabled' | 'disabled';

export type FlowAspectRatio =
  | 'IMAGE_ASPECT_RATIO_SQUARE'
  | 'IMAGE_ASPECT_RATIO_PORTRAIT'
  | 'IMAGE_ASPECT_RATIO_LANDSCAPE'
  | 'IMAGE_ASPECT_RATIO_LANDSCAPE_FOUR_THREE'
  | 'IMAGE_ASPECT_RATIO_UNSPECIFIED';

export type FlowImageModelName = 'NARWHAL' | 'IMAGEN_3_5' | 'GEM_PIX' | 'R2I';

export interface FlowClientConfig {
  cookie?: string | undefined;
  bearerToken?: string | undefined;
  googleApiKey?: string | undefined;
  apiBaseUrl?: string | undefined;
  trpcBaseUrl?: string | undefined;
  defaultProjectId?: string | undefined;
  telemetryMode?: TelemetryMode | undefined;
  retries?: number | undefined;
  timeoutMs?: {
    upload?: number | undefined;
    generate?: number | undefined;
    fetch?: number | undefined;
    default?: number | undefined;
  } | undefined;
}

export interface FlowSessionUser {
  name?: string | undefined;
  email?: string | undefined;
}

export interface FlowSessionResponse {
  access_token?: string | undefined;
  expires?: string | undefined;
  user?: FlowSessionUser | undefined;
  error?: string | undefined;
}

export interface FlowApiErrorPayload {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: unknown[];
  };
}

export interface FlowRequestOptions {
  timeoutMs?: number | undefined;
  retries?: number | undefined;
  idempotent?: boolean | undefined;
  endpointClass?: 'upload' | 'generate' | 'fetch' | 'default' | undefined;
}

export interface FlowUploadImageRequest {
  imageInput: {
    rawImageBytes: string;
    mimeType: string;
    isUserUploaded: boolean;
  };
  clientContext: {
    sessionId: string;
    tool: 'ASSET_MANAGER' | 'PINHOLE';
    projectId?: string;
  };
}

export interface FlowUploadImageResponse {
  mediaGenerationId?: {
    mediaGenerationId?: string | undefined;
    mediaType?: string | undefined;
  } | undefined;
  width?: number | undefined;
  height?: number | undefined;
  name?: string | undefined;
}

export interface FlowAcknowledgeResponse {
  acknowledged?: boolean;
  acknowledgementVersion?: string;
  [key: string]: unknown;
}

export interface FlowCreditsResponse {
  credits?: number;
  remainingCredits?: number;
  [key: string]: unknown;
}

export interface FlowStructuredPrompt {
  parts: Array<{ text: string }>;
}

export interface FlowBatchGenerateImageInput {
  imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE' | 'IMAGE_INPUT_TYPE_UNSPECIFIED';
  name: string;
}

export interface FlowBatchGenerateRequest {
  clientContext: {
    recaptchaContext?: {
      token: string;
      applicationType?: string | undefined;
    } | undefined;
    projectId: string;
    tool: 'PINHOLE';
    sessionId: string;
  };
  mediaGenerationContext?: {
    batchId: string;
  };
  useNewMedia?: boolean;
  requests: Array<{
    clientContext: {
      recaptchaContext?: {
        token: string;
        applicationType?: string;
      };
      projectId: string;
      tool: 'PINHOLE';
      sessionId: string;
    };
    imageModelName?: FlowImageModelName;
    imageAspectRatio?: FlowAspectRatio;
    structuredPrompt: FlowStructuredPrompt;
    seed?: number;
    imageInputs?: FlowBatchGenerateImageInput[];
  }>;
}

export interface FlowGeneratedImage {
  mediaGenerationId?: string;
  encodedImage?: string;
  fifeUrl?: string;
  prompt?: string;
  aspectRatio?: FlowAspectRatio;
  seed?: number;
  workflowId?: string;
}

export interface FlowGeneratedMedia {
  name?: string;
  workflowId?: string;
  image?: {
    generatedImage?: FlowGeneratedImage;
  };
}

export interface FlowBatchGenerateResponse {
  generatedMedia?: Array<{
    generatedImages?: FlowGeneratedImage[];
  }>;
  imagePanels?: Array<{
    generatedImages?: FlowGeneratedImage[];
  }>;
  media?: FlowGeneratedMedia[];
  workflows?: Array<{
    name?: string;
    projectId?: string;
    metadata?: {
      displayName?: string;
      createTime?: string;
      primaryMediaId?: string;
      batchId?: string;
    };
  }>;
  [key: string]: unknown;
}

export interface FlowWorkflowPatchRequest {
  workflow: {
    name: string;
    projectId: string;
    metadata: {
      displayName: string;
    };
  };
  updateMask: 'metadata.displayName';
}

export interface FlowWorkflowPatchResponse {
  name?: string;
  projectId?: string;
  metadata?: {
    displayName?: string;
  };
  [key: string]: unknown;
}

export interface FlowCreateWorkflowResponse {
  workflowId: string;
  projectId?: string;
}

export interface FlowDeleteMediaResponse {
  success?: boolean;
  [key: string]: unknown;
}

export interface FlowCaptionResponse {
  candidates: Array<{
    output: string;
    mediaGenerationId?: string;
  }>;
}

export interface FlowMediaRedirectResponse {
  result?: {
    data?: {
      json?: {
        mediaUrl?: string;
        redirectUrl?: string;
        url?: string;
      };
    };
  };
  mediaUrl?: string;
  redirectUrl?: string;
  url?: string;
}

export interface FlowTelemetryEvent {
  event: string;
  eventTime?: string;
  eventProperties?: Array<{
    key: string;
    stringValue?: string;
    doubleValue?: number;
    booleanValue?: boolean;
  }>;
  eventMetadata?: {
    sessionId?: string;
  };
}

export interface FlowFrontendEvent {
  eventType: string;
  metadata?: Record<string, unknown>;
}

export interface OpenAIImageGenerationRequest {
  model: string;
  prompt: string;
  n?: number;
  size?: '1024x1024' | '1024x1792' | '1792x1024';
  response_format?: 'b64_json' | 'url';
  user?: string;
  seed?: number;
  project_id?: string;
  recaptcha_token?: string;
  references?: string[];
}

export interface OpenAIImageEditRequest {
  model: string;
  prompt: string;
  images: string[];
  n?: number;
  size?: '1024x1024' | '1024x1792' | '1792x1024';
  response_format?: 'b64_json' | 'url';
  user?: string;
  seed?: number;
  project_id?: string;
  recaptcha_token?: string;
}

export interface OpenAIImageResponse {
  created: number;
  data: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
    media_id?: string;
  }>;
}
