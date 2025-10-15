import { WorkflowNode, ExecutionContext, WorkflowError } from '@/types/workflow';

export interface ErrorHandlerConfig {
  maxRetries: number;
  retryDelayMs: number;
  fallbackNodeId?: string;
  errorNotificationWebhook?: string;
  logErrors: boolean;
}

export class WorkflowErrorHandler {
  private config: ErrorHandlerConfig;

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries || 3,
      retryDelayMs: config.retryDelayMs || 1000,
      logErrors: config.logErrors !== false,
    };
  }

  /**
   * Handle an error that occurs during workflow execution
   */
  async handleError(
    error: Error,
    node: WorkflowNode,
    context: ExecutionContext,
    workflow: any
  ): Promise<{
    shouldRetry: boolean;
    shouldContinue: boolean;
    fallbackAction?: string;
    error: WorkflowError;
  }> {
    const workflowError: WorkflowError = {
      code: this.getErrorCode(error),
      message: error.message,
      nodeId: node.id,
      executionId: context.executionId,
      timestamp: new Date().toISOString(),
      details: {
        nodeType: node.type,
        nodeLabel: node.data.label,
        workflowId: context.workflowId,
        stepResults: context.stepResults,
      },
    };

    if (this.config.logErrors) {
      console.error('Workflow execution error:', workflowError);
    }

    // Determine if we should retry
    const shouldRetry = this.shouldRetryError(error, context);
    
    // Determine if we should continue execution
    const shouldContinue = this.shouldContinueExecution(error, node, context);
    
    // Determine fallback action
    const fallbackAction = this.getFallbackAction(error, node, context, workflow);

    // Send error notification if configured
    if (this.config.errorNotificationWebhook) {
      await this.sendErrorNotification(workflowError);
    }

    return {
      shouldRetry,
      shouldContinue,
      fallbackAction,
      error: workflowError,
    };
  }

  /**
   * Get error code based on error type
   */
  private getErrorCode(error: Error): string {
    if (error.message.includes('timeout')) {
      return 'TIMEOUT_ERROR';
    }
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return 'NETWORK_ERROR';
    }
    if (error.message.includes('rate limit') || error.message.includes('429')) {
      return 'RATE_LIMIT_ERROR';
    }
    if (error.message.includes('unauthorized') || error.message.includes('401')) {
      return 'AUTH_ERROR';
    }
    if (error.message.includes('forbidden') || error.message.includes('403')) {
      return 'PERMISSION_ERROR';
    }
    if (error.message.includes('not found') || error.message.includes('404')) {
      return 'NOT_FOUND_ERROR';
    }
    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return 'VALIDATION_ERROR';
    }
    if (error.message.includes('configuration') || error.message.includes('config')) {
      return 'CONFIG_ERROR';
    }
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * Determine if an error should be retried
   */
  private shouldRetryError(error: Error, context: ExecutionContext): boolean {
    const errorCode = this.getErrorCode(error);
    const retryableErrors = [
      'TIMEOUT_ERROR',
      'NETWORK_ERROR',
      'RATE_LIMIT_ERROR',
      'UNKNOWN_ERROR',
    ];

    if (!retryableErrors.includes(errorCode)) {
      return false;
    }

    // Check if we've already retried too many times
    const retryCount = context.nodeVisitCounts[context.currentNodeId || ''] || 0;
    return retryCount < this.config.maxRetries;
  }

  /**
   * Determine if execution should continue after an error
   */
  private shouldContinueExecution(
    error: Error,
    node: WorkflowNode,
    context: ExecutionContext
  ): boolean {
    const errorCode = this.getErrorCode(error);
    
    // Don't continue for critical errors
    const criticalErrors = [
      'AUTH_ERROR',
      'PERMISSION_ERROR',
      'CONFIG_ERROR',
    ];

    if (criticalErrors.includes(errorCode)) {
      return false;
    }

    // Don't continue if we've exceeded retry limit
    const retryCount = context.nodeVisitCounts[context.currentNodeId || ''] || 0;
    if (retryCount >= this.config.maxRetries) {
      return false;
    }

    // Continue for retryable errors
    return true;
  }

  /**
   * Get fallback action for an error
   */
  private getFallbackAction(
    error: Error,
    node: WorkflowNode,
    context: ExecutionContext,
    workflow: any
  ): string | undefined {
    const errorCode = this.getErrorCode(error);
    
    switch (errorCode) {
      case 'TIMEOUT_ERROR':
        return 'retry_with_longer_timeout';
      
      case 'RATE_LIMIT_ERROR':
        return 'retry_with_delay';
      
      case 'NETWORK_ERROR':
        return 'retry_with_exponential_backoff';
      
      case 'AUTH_ERROR':
        return 'skip_node';
      
      case 'PERMISSION_ERROR':
        return 'skip_node';
      
      case 'NOT_FOUND_ERROR':
        return 'skip_node';
      
      case 'VALIDATION_ERROR':
        return 'skip_node';
      
      case 'CONFIG_ERROR':
        return 'stop_execution';
      
      default:
        return 'retry_with_delay';
    }
  }

  /**
   * Send error notification to webhook
   */
  private async sendErrorNotification(error: WorkflowError): Promise<void> {
    if (!this.config.errorNotificationWebhook) {
      return;
    }

    try {
      await fetch(this.config.errorNotificationWebhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'workflow_error',
          error,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (notificationError) {
      console.error('Failed to send error notification:', notificationError);
    }
  }

  /**
   * Create a recovery strategy for a failed workflow
   */
  createRecoveryStrategy(
    failedNodeId: string,
    context: ExecutionContext,
    workflow: any
  ): {
    strategy: 'retry' | 'skip' | 'fallback' | 'stop';
    nextNodeId?: string;
    retryDelay?: number;
  } {
    const failedNode = workflow.nodes.find((n: any) => n.id === failedNodeId);
    if (!failedNode) {
      return { strategy: 'stop' };
    }

    // Check if there's a fallback node configured
    if (this.config.fallbackNodeId) {
      return {
        strategy: 'fallback',
        nextNodeId: this.config.fallbackNodeId,
      };
    }

    // Check if we can skip to the next node
    const outgoingEdges = workflow.edges.filter((e: any) => e.source === failedNodeId);
    if (outgoingEdges.length > 0) {
      return {
        strategy: 'skip',
        nextNodeId: outgoingEdges[0].target,
      };
    }

    // Default to retry with delay
    return {
      strategy: 'retry',
      retryDelay: this.config.retryDelayMs,
    };
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStatistics(context: ExecutionContext): {
    totalErrors: number;
    errorTypes: Record<string, number>;
    lastError?: WorkflowError;
  } {
    // This would typically be stored in a database or cache
    // For now, we'll return basic information
    return {
      totalErrors: 0,
      errorTypes: {},
      lastError: undefined,
    };
  }

  /**
   * Create error handler for a specific node type
   */
  static createForNodeType(nodeType: string): WorkflowErrorHandler {
    const configs: Record<string, Partial<ErrorHandlerConfig>> = {
      'agent': {
        maxRetries: 3,
        retryDelayMs: 2000,
        logErrors: true,
      },
      'action': {
        maxRetries: 2,
        retryDelayMs: 1000,
        logErrors: true,
      },
      'trigger': {
        maxRetries: 1,
        retryDelayMs: 500,
        logErrors: true,
      },
      'human-approval': {
        maxRetries: 0,
        retryDelayMs: 0,
        logErrors: true,
      },
    };

    const config = configs[nodeType] || configs['action'];
    return new WorkflowErrorHandler(config);
  }
}
