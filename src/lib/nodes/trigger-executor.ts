import { WorkflowNode, ExecutionContext, TriggerNodeConfig } from '@/types/workflow';

export interface TriggerResult {
  success: boolean;
  data: Record<string, any>;
  error?: string;
}

export class TriggerExecutor {
  async execute(
    node: WorkflowNode,
    context: ExecutionContext,
    triggerData: Record<string, any> = {}
  ): Promise<TriggerResult> {
    try {
      const config = node.data.config as TriggerNodeConfig;
      
      switch (config.triggerType) {
        case 'webhook':
          return this.handleWebhookTrigger(config, triggerData);
        case 'manual':
          return this.handleManualTrigger(config, triggerData);
        case 'schedule':
          return this.handleScheduledTrigger(config, triggerData);
        default:
          throw new Error(`Unsupported trigger type: ${config.triggerType}`);
      }
    } catch (error) {
      return {
        success: false,
        data: {},
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private handleWebhookTrigger(
    config: TriggerNodeConfig,
    triggerData: Record<string, any>
  ): TriggerResult {
    // For webhook triggers, we expect the data to be passed in
    // In a real implementation, this would validate the webhook signature, etc.
    return {
      success: true,
      data: {
        ...triggerData,
        triggerType: 'webhook',
        timestamp: new Date().toISOString(),
        webhookPath: config.webhookPath,
      },
    };
  }

  private handleManualTrigger(
    config: TriggerNodeConfig,
    triggerData: Record<string, any>
  ): TriggerResult {
    // Manual triggers are initiated by user action
    return {
      success: true,
      data: {
        ...triggerData,
        triggerType: 'manual',
        timestamp: new Date().toISOString(),
        initiatedBy: 'user',
      },
    };
  }

  private handleScheduledTrigger(
    config: TriggerNodeConfig,
    triggerData: Record<string, any>
  ): TriggerResult {
    // For scheduled triggers, we would check if it's time to run
    // This is a simplified implementation
    return {
      success: true,
      data: {
        ...triggerData,
        triggerType: 'schedule',
        timestamp: new Date().toISOString(),
        scheduleExpression: config.scheduleExpression,
      },
    };
  }

  /**
   * Validate trigger configuration
   */
  static validateConfig(config: TriggerNodeConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.triggerType) {
      errors.push('Trigger type is required');
    }

    if (config.triggerType === 'webhook' && !config.webhookPath) {
      errors.push('Webhook path is required for webhook triggers');
    }

    if (config.triggerType === 'schedule' && !config.scheduleExpression) {
      errors.push('Schedule expression is required for scheduled triggers');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
