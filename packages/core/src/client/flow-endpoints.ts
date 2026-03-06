import { FlowHttpClient } from './flow-http-client.js';
import { FlowError, FlowValidationError } from '../utils/errors.js';
import type {
  FlowAcknowledgeResponse,
  FlowBatchGenerateRequest,
  FlowBatchGenerateResponse,
  FlowCaptionResponse,
  FlowCreateWorkflowResponse,
  FlowCreditsResponse,
  FlowDeleteMediaResponse,
  FlowMediaRedirectResponse,
  FlowUploadImageRequest,
  FlowUploadImageResponse,
  FlowWorkflowPatchRequest,
  FlowWorkflowPatchResponse,
} from '../types/flow.js';

interface FlowEndpointsOptions {
  client: FlowHttpClient;
  googleApiKey?: string | undefined;
}

export class FlowEndpoints {
  private readonly client: FlowHttpClient;
  private readonly googleApiKey: string | undefined;

  constructor(options: FlowEndpointsOptions) {
    this.client = options.client;
    this.googleApiKey = options.googleApiKey;
  }

  async fetchUserAcknowledgement(
    acknowledgementVersion: string = 'FLOW_IMAGE_UPLOAD_TOS',
  ): Promise<FlowAcknowledgeResponse> {
    const input = encodeURIComponent(
      JSON.stringify({
        json: { acknowledgementVersion },
      }),
    );

    const url = this.client.getTrpcUrl(`/general.fetchUserAcknowledgement?input=${input}`);
    return this.client.get<FlowAcknowledgeResponse>(url, { skipAuth: true }, { endpointClass: 'default' });
  }

  async getCredits(): Promise<FlowCreditsResponse> {
    const suffix = this.googleApiKey ? `?key=${encodeURIComponent(this.googleApiKey)}` : '';
    const url = this.client.getApiUrl(`/v1/credits${suffix}`);
    return this.client.get<FlowCreditsResponse>(url, undefined, { endpointClass: 'fetch' });
  }

  async uploadImage(payload: FlowUploadImageRequest): Promise<FlowUploadImageResponse> {
    const url = this.client.getApiUrl('/v1/flow/uploadImage');
    return this.client.post<FlowUploadImageResponse>(url, payload, undefined, {
      endpointClass: 'upload',
      retries: 2,
      idempotent: false,
    });
  }

  async batchGenerateImages(
    projectId: string,
    payload: FlowBatchGenerateRequest,
  ): Promise<FlowBatchGenerateResponse> {
    const url = this.client.getApiUrl(
      `/v1/projects/${encodeURIComponent(projectId)}/flowMedia:batchGenerateImages`,
    );
    return this.client.post<FlowBatchGenerateResponse>(url, payload, undefined, {
      endpointClass: 'generate',
      retries: 2,
      idempotent: true,
    });
  }

  async patchWorkflow(
    workflowId: string,
    payload: FlowWorkflowPatchRequest,
  ): Promise<FlowWorkflowPatchResponse> {
    const url = this.client.getApiUrl(`/v1/flowWorkflows/${encodeURIComponent(workflowId)}`);
    return this.client.patch<FlowWorkflowPatchResponse>(url, payload, undefined, {
      endpointClass: 'default',
      retries: 2,
      idempotent: true,
    });
  }

  async createWorkflow(displayName: string): Promise<FlowCreateWorkflowResponse> {
    const url = this.client.getTrpcUrl('/project.createProject');
    const raw = await this.client.post<unknown>(
      url,
      {
        json: {
          projectTitle: displayName,
          toolName: 'PINHOLE',
        },
      },
      {
        skipAuth: true,
        headers: {
          'content-type': 'application/json',
        },
      },
      { endpointClass: 'default', retries: 1 },
    );

    if (!raw || typeof raw !== 'object') {
      throw new FlowValidationError('Invalid create project response payload', raw);
    }

    const payload = raw as {
      result?: {
        data?: {
          json?: {
            result?: {
              projectId?: string;
            };
          };
        };
      };
    };

    const projectId = payload.result?.data?.json?.result?.projectId;
    if (!projectId?.trim()) {
      throw new FlowValidationError('projectId missing in create project response', raw);
    }

    return { workflowId: projectId, projectId };
  }

  async deleteMedia(mediaIds: string[]): Promise<FlowDeleteMediaResponse> {
    const url = this.client.getTrpcUrl('/media.deleteMedia');
    return this.client.post<FlowDeleteMediaResponse>(
      url,
      { json: { names: mediaIds } },
      {
        skipAuth: true,
        headers: {
          'content-type': 'application/json',
        },
      },
      { endpointClass: 'default', retries: 1 },
    );
  }

  async captionImage(rawBytes: string, count = 1): Promise<FlowCaptionResponse> {
    const url = this.client.getTrpcUrl('/backbone.captionImage');
    return this.client.post<FlowCaptionResponse>(
      url,
      {
        json: {
          captionInput: {
            candidatesCount: count,
            mediaInput: {
              rawBytes,
              mediaCategory: 'MEDIA_CATEGORY_SUBJECT',
            },
          },
        },
      },
      {
        skipAuth: true,
        headers: {
          'content-type': 'application/json',
        },
      },
      { endpointClass: 'default', retries: 1 },
    );
  }

  async getMediaUrlRedirect(mediaId: string): Promise<string | undefined> {
    if (!mediaId.trim()) {
      throw new FlowError('mediaId is required', 400);
    }
    const url = this.client.getTrpcUrl(
      `/media.getMediaUrlRedirect?name=${encodeURIComponent(mediaId)}`,
    );

    const data = await this.client.get<FlowMediaRedirectResponse>(
      url,
      {
        skipAuth: true,
        headers: {
          accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          referer: 'https://labs.google/',
        },
      },
      { endpointClass: 'fetch', retries: 1 },
    );

    return (
      data.result?.data?.json?.mediaUrl ??
      data.result?.data?.json?.redirectUrl ??
      data.result?.data?.json?.url ??
      data.mediaUrl ??
      data.redirectUrl ??
      data.url
    );
  }

  async downloadSignedMedia(url: string): Promise<ArrayBuffer> {
    if (!url.startsWith('https://')) {
      throw new FlowError('Signed media URL must be https', 400);
    }

    const response = await fetch(url, {
      headers: {
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        origin: 'https://labs.google',
        referer: 'https://labs.google/',
      },
    });

    if (!response.ok) {
      throw new FlowError(`Signed URL download failed (${response.status})`, response.status);
    }

    return response.arrayBuffer();
  }
}
