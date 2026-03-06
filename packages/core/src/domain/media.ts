import { FlowEndpoints } from '../client/flow-endpoints.js';
import { FlowValidationError } from '../utils/errors.js';
import type { FlowWorkflowPatchResponse } from '../types/flow.js';

interface MediaOptions {
  endpoints: FlowEndpoints;
}

export class Media {
  private readonly endpoints: FlowEndpoints;

  constructor(options: MediaOptions) {
    this.endpoints = options.endpoints;
  }

  async fetchById(mediaId: string): Promise<string> {
    if (!mediaId.trim()) {
      throw new FlowValidationError('mediaId is required');
    }

    const redirect = await this.endpoints.getMediaUrlRedirect(mediaId);
    if (!redirect) {
      throw new FlowValidationError('No media redirect URL returned');
    }

    return redirect;
  }

  async save(mediaId: string): Promise<Buffer> {
    const redirect = await this.fetchById(mediaId);
    const bytes = await this.endpoints.downloadSignedMedia(redirect);
    return Buffer.from(bytes);
  }

  async delete(mediaId: string): Promise<void> {
    if (!mediaId.trim()) throw new FlowValidationError('mediaId is required');
    await this.endpoints.deleteMedia([mediaId]);
  }

  async refine(mediaId: string, prompt: string): Promise<{ mediaId: string; prompt: string }> {
    if (!mediaId.trim()) throw new FlowValidationError('mediaId is required');
    if (!prompt.trim()) throw new FlowValidationError('prompt is required');

    return { mediaId, prompt };
  }

  async caption(rawImageBytes: string, count = 1): Promise<string[]> {
    if (!rawImageBytes.trim()) throw new FlowValidationError('rawImageBytes is required');
    const result = await this.endpoints.captionImage(rawImageBytes, count);
    return result.candidates.map((candidate) => candidate.output);
  }

  async animate(_mediaId: string): Promise<void> {
    throw new FlowValidationError('animate endpoint is feature-gated and currently disabled');
  }

  async renameWorkflow(
    workflowId: string,
    projectId: string,
    displayName: string,
  ): Promise<FlowWorkflowPatchResponse> {
    if (!workflowId.trim()) throw new FlowValidationError('workflowId is required');
    if (!projectId.trim()) throw new FlowValidationError('projectId is required');
    if (!displayName.trim()) throw new FlowValidationError('displayName is required');

    return this.endpoints.patchWorkflow(workflowId, {
      workflow: {
        name: workflowId,
        projectId,
        metadata: { displayName },
      },
      updateMask: 'metadata.displayName',
    });
  }
}
