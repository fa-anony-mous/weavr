import { WorkflowNode, ExecutionContext, ActionNodeConfig } from '@/types/workflow';

export interface ActionResult {
  success: boolean;
  data: Record<string, any>;
  error?: string;
  statusCode?: number;
}

export class ActionExecutor {
  async execute(
    node: WorkflowNode,
    context: ExecutionContext
  ): Promise<ActionResult> {
    try {
      const config = node.data.config as ActionNodeConfig;
      
      switch (config.actionType) {
        case 'http-request':
          return this.handleHttpRequest(config, context);
        case 'data-transform':
          return this.handleDataTransform(config, context);
        case 'notification':
          return this.handleNotification(config, context);
        case 'custom':
          return this.handleCustomAction(config, context);
        default:
          throw new Error(`Unsupported action type: ${config.actionType}`);
      }
    } catch (error) {
      return {
        success: false,
        data: {},
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleHttpRequest(
    config: ActionNodeConfig,
    context: ExecutionContext
  ): Promise<ActionResult> {
    if (!config.httpUrl) {
      throw new Error('HTTP URL is required for HTTP request actions');
    }

    try {
      const response = await fetch(config.httpUrl, {
        method: config.httpMethod || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...config.httpHeaders,
        },
        body: config.httpMethod !== 'GET' ? JSON.stringify(context.variables) : undefined,
      });

      const data = await response.json().catch(() => ({}));

      return {
        success: response.ok,
        data: {
          response: data,
          statusCode: response.status,
          headers: Object.fromEntries(response.headers.entries()),
        },
        statusCode: response.status,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (error) {
      return {
        success: false,
        data: {},
        error: `HTTP request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private handleDataTransform(
    config: ActionNodeConfig,
    context: ExecutionContext
  ): Promise<ActionResult> {
    if (!config.transformScript) {
      throw new Error('Transform script is required for data transform actions');
    }

    try {
      // Create a safe evaluation context
      const safeContext = {
        ...context.variables,
        input: context.variables,
        data: context.stepResults,
      };

      // Simple variable substitution for now
      // In production, you'd want a more robust expression evaluator
      let result = config.transformScript;
      
      // Replace {{variable}} patterns
      result = result.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        const value = (safeContext as any)[varName];
        return value !== undefined ? JSON.stringify(value) : match;
      });

      // Try to parse as JSON if it looks like JSON
      let parsedResult;
      try {
        parsedResult = JSON.parse(result);
      } catch {
        parsedResult = result;
      }

      return Promise.resolve({
        success: true,
        data: {
          transformed: parsedResult,
          original: context.variables,
        },
      });
    } catch (error) {
      return Promise.resolve({
        success: false,
        data: {},
        error: `Data transform failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  private handleNotification(
    config: ActionNodeConfig,
    context: ExecutionContext
  ): Promise<ActionResult> {
    // This is a simplified notification handler
    // In production, you'd integrate with actual notification services
    
    const notificationData = {
      type: config.notificationType || 'webhook',
      message: context.variables.message || 'Workflow notification',
      timestamp: new Date().toISOString(),
      context: context.variables,
    };

    return Promise.resolve({
      success: true,
      data: {
        notification: notificationData,
        sent: true,
      },
    });
  }

  private handleCustomAction(
    config: ActionNodeConfig,
    context: ExecutionContext
  ): Promise<ActionResult> {
    if (!config.customScript) {
      throw new Error('Custom script is required for custom actions');
    }

    try {
      // This is a simplified custom action handler
      // In production, you'd want a sandboxed execution environment
      const result = {
        executed: true,
        script: config.customScript,
        context: context.variables,
        timestamp: new Date().toISOString(),
      };

      return Promise.resolve({
        success: true,
        data: result,
      });
    } catch (error) {
      return Promise.resolve({
        success: false,
        data: {},
        error: `Custom action failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  /**
   * Validate action configuration
   */
  static validateConfig(config: ActionNodeConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.actionType) {
      errors.push('Action type is required');
    }

    if (config.actionType === 'http-request' && !config.httpUrl) {
      errors.push('HTTP URL is required for HTTP request actions');
    }

    if (config.actionType === 'data-transform' && !config.transformScript) {
      errors.push('Transform script is required for data transform actions');
    }

    if (config.actionType === 'custom' && !config.customScript) {
      errors.push('Custom script is required for custom actions');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
