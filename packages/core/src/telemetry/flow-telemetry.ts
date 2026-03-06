import { FlowHttpClient } from '../client/flow-http-client.js';
import type { FlowFrontendEvent, FlowTelemetryEvent, TelemetryMode } from '../types/flow.js';
import { defaultLogger, type FlowLogger } from '../utils/logger.js';

interface FlowTelemetryOptions {
  mode?: TelemetryMode | undefined;
  client: FlowHttpClient;
  logger?: FlowLogger | undefined;
}

export class FlowTelemetry {
  private readonly mode: TelemetryMode;
  private readonly client: FlowHttpClient;
  private readonly logger: FlowLogger;

  constructor(options: FlowTelemetryOptions) {
    this.mode = options.mode ?? 'enabled';
    this.client = options.client;
    this.logger = options.logger ?? defaultLogger;
  }

  isEnabled(): boolean {
    return this.mode === 'enabled';
  }

  async sendBatchLog(events: FlowTelemetryEvent[]): Promise<void> {
    if (!this.isEnabled()) return;
    if (!events.length) return;

    await this.client.post(this.client.getApiUrl('/v1:batchLog'), { appEvents: events }, undefined, {
      endpointClass: 'default',
      retries: 1,
      idempotent: true,
    });

    this.logger.debug('Telemetry batchLog sent', { count: events.length });
  }

  async sendFrontendEvents(events: FlowFrontendEvent[]): Promise<void> {
    if (!this.isEnabled()) return;
    if (!events.length) return;

    await this.client.post(
      this.client.getApiUrl('/v1/flow:batchLogFrontendEvents'),
      { events },
      undefined,
      {
        endpointClass: 'default',
        retries: 1,
        idempotent: true,
      },
    );

    this.logger.debug('Telemetry frontend events sent', { count: events.length });
  }
}
