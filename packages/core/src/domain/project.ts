import { FlowEndpoints } from '../client/flow-endpoints.js';
import type {
  FlowBatchGenerateImageInput,
  FlowBatchGenerateRequest,
  FlowBatchGenerateResponse,
  FlowImageModelName,
  FlowUploadImageRequest,
} from '../types/flow.js';
import { createId, createSessionId } from '../utils/id.js';
import { FlowValidationError } from '../utils/errors.js';
import { Prompt } from './prompt.js';

interface ProjectOptions {
  projectId: string;
  endpoints: FlowEndpoints;
  sessionId?: string;
}

interface CreateProjectOptions {
  displayName?: string | undefined;
  endpoints: FlowEndpoints;
}

interface GenerateOptions {
  recaptchaToken?: string;
  seed?: number;
  references?: FlowBatchGenerateImageInput[];
  model?: FlowImageModelName;
}

interface UploadReferenceOptions {
  rawImageBytes: string;
  mimeType?: string;
}

export class Project {
  readonly projectId: string;
  private readonly endpoints: FlowEndpoints;
  readonly sessionId: string;

  static async create(options: CreateProjectOptions): Promise<Project> {
    const created = await options.endpoints.createWorkflow(
      options.displayName ?? `New Project - ${new Date().toISOString()}`,
    );

    return new Project({
      projectId: created.workflowId,
      endpoints: options.endpoints,
      sessionId: createSessionId(),
    });
  }

  constructor(options: ProjectOptions) {
    if (!options.projectId.trim()) {
      throw new FlowValidationError('projectId is required');
    }
    this.projectId = options.projectId;
    this.endpoints = options.endpoints;
    this.sessionId = options.sessionId ?? createSessionId();
  }

  async uploadReference(options: UploadReferenceOptions): Promise<string> {
    if (!options.rawImageBytes?.trim()) {
      throw new FlowValidationError('rawImageBytes is required');
    }

    const payload: FlowUploadImageRequest = {
      imageInput: {
        rawImageBytes: options.rawImageBytes,
        mimeType: options.mimeType ?? 'image/jpeg',
        isUserUploaded: true,
      },
      clientContext: {
        sessionId: this.sessionId,
        tool: 'ASSET_MANAGER',
        projectId: this.projectId,
      },
    };

    const upload = await this.endpoints.uploadImage(payload);
    const mediaId = upload.mediaGenerationId?.mediaGenerationId ?? upload.name;
    if (!mediaId) {
      throw new FlowValidationError('Upload succeeded but media id is missing');
    }

    return mediaId;
  }

  async generateImage(promptText: string, options: GenerateOptions = {}): Promise<FlowBatchGenerateResponse> {
    const promptInput: {
      prompt: string;
      seed?: number;
      model?: FlowImageModelName;
      references?: FlowBatchGenerateImageInput[];
    } = { prompt: promptText };

    if (options.seed !== undefined) promptInput.seed = options.seed;
    if (options.model !== undefined) promptInput.model = options.model;
    if (options.references !== undefined) promptInput.references = options.references;

    const prompt = new Prompt(promptInput);
    return this.generate(prompt, options.recaptchaToken);
  }

  async generateImageWithReferences(
    promptText: string,
    references: FlowBatchGenerateImageInput[],
    options: Omit<GenerateOptions, 'references'> = {},
  ): Promise<FlowBatchGenerateResponse> {
    const promptInput: {
      prompt: string;
      seed?: number;
      model?: FlowImageModelName;
      references: FlowBatchGenerateImageInput[];
    } = {
      prompt: promptText,
      references,
    };

    if (options.seed !== undefined) promptInput.seed = options.seed;
    if (options.model !== undefined) promptInput.model = options.model;

    const prompt = new Prompt(promptInput);
    return this.generate(prompt, options.recaptchaToken);
  }

  private async generate(prompt: Prompt, recaptchaToken?: string): Promise<FlowBatchGenerateResponse> {
    if (!recaptchaToken?.trim()) {
      throw new FlowValidationError('recaptcha token is required for generation');
    }

    const requestBody: {
      clientContext: {
        recaptchaContext: {
          token: string;
          applicationType: string;
        };
        projectId: string;
        tool: 'PINHOLE';
        sessionId: string;
      };
      imageModelName?: FlowImageModelName;
      imageAspectRatio?:
        | 'IMAGE_ASPECT_RATIO_SQUARE'
        | 'IMAGE_ASPECT_RATIO_PORTRAIT'
        | 'IMAGE_ASPECT_RATIO_LANDSCAPE'
        | 'IMAGE_ASPECT_RATIO_LANDSCAPE_FOUR_THREE'
        | 'IMAGE_ASPECT_RATIO_UNSPECIFIED';
      structuredPrompt: { parts: Array<{ text: string }> };
      seed?: number;
      imageInputs?: FlowBatchGenerateImageInput[];
    } = {
      clientContext: {
        recaptchaContext: {
          token: recaptchaToken,
          applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB',
        },
        projectId: this.projectId,
        tool: 'PINHOLE',
        sessionId: this.sessionId,
      },
      imageModelName: prompt.model,
      imageAspectRatio: prompt.aspectRatio,
      structuredPrompt: prompt.toStructuredPrompt(),
    };

    if (prompt.seed !== undefined) requestBody.seed = prompt.seed;
    if (prompt.references.length) requestBody.imageInputs = prompt.references;

    const payload: FlowBatchGenerateRequest = {
      clientContext: {
        recaptchaContext: {
          token: recaptchaToken,
          applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB',
        },
        projectId: this.projectId,
        tool: 'PINHOLE',
        sessionId: this.sessionId,
      },
      mediaGenerationContext: {
        batchId: createId(),
      },
      useNewMedia: true,
      requests: [requestBody],
    };

    return this.endpoints.batchGenerateImages(this.projectId, payload);
  }
}
