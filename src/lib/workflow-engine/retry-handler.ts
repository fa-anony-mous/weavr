import { WorkflowNode, ExecutionContext } from '@/types/workflow';

export interface RetryConfig {
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface RetryResult {
  success: boolean;
  result?: any;
  error?: string;
  attempts: number;
  totalDelayMs: number;
}

export class RetryHandler {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries || 3,
      retryDelayMs: config.retryDelayMs || 1000,
      backoffMultiplier: config.backoffMultiplier || 2,
      retryableErrors: config.retryableErrors || [
        'timeout',
        'network',
        'rate_limit',
        'temporary',
        'unavailable',
      ],
    };
  }

  /**
   * Execute a function with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ExecutionContext,
    node: WorkflowNode
  ): Promise<RetryResult> {
    let lastError: Error | null = null;
    let totalDelayMs = 0;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        return {
          success: true,
          result,
          attempts: attempt,
          totalDelayMs,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Check if error is retryable
        if (!this.isRetryableError(lastError)) {
          return {
            success: false,
            error: lastError.message,
            attempts: attempt,
            totalDelayMs,
          };
        }

        // Don't retry on the last attempt
        if (attempt === this.config.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = this.config.retryDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
        totalDelayMs += delay;

        // Log retry attempt
        console.warn(`Retry attempt ${attempt}/${this.config.maxRetries} for node ${node.id}: ${lastError.message}`);
        
        // Wait before retry
        await this.delay(delay);
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Max retries exceeded',
      attempts: this.config.maxRetries,
      totalDelayMs,
    };
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    return this.config.retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError.toLowerCase())
    );
  }

  /**
   * Delay execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get retry configuration for a specific node type
   */
  static getRetryConfigForNodeType(nodeType: string): Partial<RetryConfig> {
    switch (nodeType) {
      case 'agent':
        return {
          maxRetries: 3,
          retryDelayMs: 2000,
          backoffMultiplier: 2,
          retryableErrors: ['timeout', 'rate_limit', 'temporary', 'unavailable'],
        };
      
      case 'action':
        return {
          maxRetries: 2,
          retryDelayMs: 1000,
          backoffMultiplier: 1.5,
          retryableErrors: ['timeout', 'network', 'temporary'],
        };
      
      case 'trigger':
        return {
          maxRetries: 1,
          retryDelayMs: 500,
          backoffMultiplier: 1,
          retryableErrors: ['temporary'],
        };
      
      default:
        return {
          maxRetries: 2,
          retryDelayMs: 1000,
          backoffMultiplier: 1.5,
          retryableErrors: ['timeout', 'temporary'],
        };
    }
  }

  /**
   * Create a retry handler for a specific node
   */
  static createForNode(node: WorkflowNode): RetryHandler {
    const config = RetryHandler.getRetryConfigForNodeType(node.type);
    return new RetryHandler(config);
  }
}
