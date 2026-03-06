import { Project } from '../domain/project.js';
import type {
  OpenAIImageEditRequest,
  OpenAIImageGenerationRequest,
  OpenAIImageResponse,
  FlowBatchGenerateImageInput,
  FlowGeneratedImage,
} from '../types/flow.js';
import { FlowValidationError } from '../utils/errors.js';

function mapModel(model: string) {
  if (model === 'nano-banana-r2i') return 'R2I' as const;
  if (model === 'nano-banana') return 'NARWHAL' as const;
  if (model === 'IMAGEN_4') return 'IMAGEN_3_5' as const;
  return 'NARWHAL' as const;
}

function toOpenAIData(
  images: FlowGeneratedImage[],
  responseFormat: OpenAIImageGenerationRequest['response_format'],
): OpenAIImageResponse['data'] {
  return images.map((image) => {
    const row: {
      b64_json?: string;
      url?: string;
      revised_prompt?: string;
      media_id?: string;
    } = {};

    if (responseFormat === 'url') {
      if (image.fifeUrl) row.url = image.fifeUrl;
      else if (image.mediaGenerationId) row.url = image.mediaGenerationId;
    } else if (image.encodedImage) {
      row.b64_json = image.encodedImage;
    } else if (image.fifeUrl) {
      row.url = image.fifeUrl;
    }

    if (image.prompt) row.revised_prompt = image.prompt;
    if (image.mediaGenerationId) row.media_id = image.mediaGenerationId;
    return row;
  });
}

interface AdapterOptions {
  projectFactory: (projectId: string) => Project;
}

export class OpenAIImageAdapter {
  private readonly projectFactory: AdapterOptions['projectFactory'];

  constructor(options: AdapterOptions) {
    this.projectFactory = options.projectFactory;
  }

  async generate(request: OpenAIImageGenerationRequest): Promise<OpenAIImageResponse> {
    if (!request.project_id?.trim()) {
      throw new FlowValidationError('project_id is required');
    }

    const project = this.projectFactory(request.project_id);
    const refs: FlowBatchGenerateImageInput[] = (request.references ?? []).map((name) => ({
      imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE',
      name,
    }));

    const opts: { recaptchaToken?: string; seed?: number; model?: 'NARWHAL' | 'IMAGEN_3_5' | 'R2I' } = {
      model: mapModel(request.model),
    };
    if (request.recaptcha_token) opts.recaptchaToken = request.recaptcha_token;
    if (request.seed !== undefined) opts.seed = request.seed;

    const response = await project.generateImageWithReferences(request.prompt, refs, opts);

    const images =
      response.generatedMedia?.flatMap((item) => item.generatedImages ?? []) ??
      response.imagePanels?.flatMap((item) => item.generatedImages ?? []) ??
      response.media?.flatMap((item) =>
        item.image?.generatedImage ? [item.image.generatedImage] : [],
      ) ??
      [];

    return {
      created: Math.floor(Date.now() / 1000),
      data: toOpenAIData(images, request.response_format),
    };
  }

  async imageEdit(request: OpenAIImageEditRequest): Promise<OpenAIImageResponse> {
    if (!request.project_id?.trim()) {
      throw new FlowValidationError('project_id is required');
    }

    const project = this.projectFactory(request.project_id);
    const refs: FlowBatchGenerateImageInput[] = [];

    for (const img of request.images) {
      const base64 = img.includes(',') ? img.split(',').pop() ?? '' : img;
      const mediaId = await project.uploadReference({
        rawImageBytes: base64,
        mimeType: 'image/jpeg',
      });
      refs.push({ imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE', name: mediaId });
    }

    const opts: { recaptchaToken?: string; seed?: number; model?: 'NARWHAL' | 'IMAGEN_3_5' | 'R2I' } = {
      model: mapModel(request.model),
    };
    if (request.recaptcha_token) opts.recaptchaToken = request.recaptcha_token;
    if (request.seed !== undefined) opts.seed = request.seed;

    const response = await project.generateImageWithReferences(request.prompt, refs, opts);

    const images =
      response.generatedMedia?.flatMap((item) => item.generatedImages ?? []) ??
      response.imagePanels?.flatMap((item) => item.generatedImages ?? []) ??
      response.media?.flatMap((item) =>
        item.image?.generatedImage ? [item.image.generatedImage] : [],
      ) ??
      [];

    return {
      created: Math.floor(Date.now() / 1000),
      data: toOpenAIData(images, request.response_format),
    };
  }
}
