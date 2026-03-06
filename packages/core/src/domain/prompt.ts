import type {
  FlowAspectRatio,
  FlowBatchGenerateImageInput,
  FlowImageModelName,
} from '../types/flow.js';
import { FlowValidationError } from '../utils/errors.js';

export interface PromptBuilderInput {
  prompt: string;
  seed?: number;
  model?: FlowImageModelName;
  aspectRatio?: FlowAspectRatio;
  count?: number;
  references?: FlowBatchGenerateImageInput[];
}

export class Prompt {
  readonly prompt: string;
  readonly seed: number | undefined;
  readonly model: FlowImageModelName;
  readonly aspectRatio: FlowAspectRatio;
  readonly count: number;
  readonly references: FlowBatchGenerateImageInput[];

  constructor(input: PromptBuilderInput) {
    if (!input.prompt?.trim()) {
      throw new FlowValidationError('prompt is required');
    }

    const count = input.count ?? 1;
    if (count < 1 || count > 8) {
      throw new FlowValidationError('count must be between 1 and 8');
    }

    this.prompt = input.prompt;
    this.seed = input.seed;
    this.model = input.model ?? 'NARWHAL';
    this.aspectRatio = input.aspectRatio ?? 'IMAGE_ASPECT_RATIO_LANDSCAPE';
    this.count = count;
    this.references = input.references ?? [];
  }

  toStructuredPrompt(): { parts: Array<{ text: string }> } {
    return {
      parts: [{ text: this.prompt }],
    };
  }
}
