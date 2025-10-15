import { WorkflowNode, ExecutionContext, AgentNodeConfig } from '@/types/workflow';
import { groqClient } from '@/lib/groq-client';

export interface AgentResult {
  success: boolean;
  data: Record<string, any>;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class AgentExecutor {
  async execute(
    node: WorkflowNode,
    context: ExecutionContext
  ): Promise<AgentResult> {
    try {
      const config = node.data.config as AgentNodeConfig;
      
      // Validate configuration
      const validation = AgentExecutor.validateConfig(config);
      if (!validation.isValid) {
        throw new Error(`Invalid agent configuration: ${validation.errors.join(', ')}`);
      }

      // Prepare context for the agent
      const agentContext = {
        ...context.variables,
        stepResults: context.stepResults,
        currentNodeId: node.id,
        executionId: context.executionId,
        workflowId: context.workflowId,
      };

      // Call Groq LLM
      const response = await groqClient.executeAgentNode(config, agentContext);

      // Parse the response
      let parsedData;
      try {
        // Try to parse as JSON first
        parsedData = JSON.parse(response.content);
      } catch {
        // If not JSON, treat as plain text
        parsedData = {
          text: response.content,
          raw: response.content,
        };
      }

      return {
        success: true,
        data: {
          response: parsedData,
          model: response.model,
          finishReason: response.finishReason,
          timestamp: new Date().toISOString(),
        },
        usage: response.usage,
      };
    } catch (error) {
      return {
        success: false,
        data: {},
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute agent with retry logic
   */
  async executeWithRetry(
    node: WorkflowNode,
    context: ExecutionContext,
    maxRetries: number = 3
  ): Promise<AgentResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.execute(node, context);
        
        if (result.success) {
          return result;
        }
        
        lastError = new Error(result.error || 'Agent execution failed');
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Wait before retry
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    return {
      success: false,
      data: {},
      error: `Agent execution failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
    };
  }

  /**
   * Execute multiple agents in parallel
   */
  async executeParallel(
    nodes: WorkflowNode[],
    context: ExecutionContext
  ): Promise<AgentResult[]> {
    const promises = nodes.map(node => this.execute(node, context));
    return Promise.all(promises);
  }

  /**
   * Execute agents sequentially
   */
  async executeSequential(
    nodes: WorkflowNode[],
    context: ExecutionContext
  ): Promise<AgentResult[]> {
    const results: AgentResult[] = [];
    
    for (const node of nodes) {
      const result = await this.execute(node, context);
      results.push(result);
      
      // If any agent fails, we might want to stop or continue based on configuration
      if (!result.success) {
        // For now, we'll continue, but this could be configurable
        console.warn(`Agent ${node.id} failed: ${result.error}`);
      }
    }
    
    return results;
  }

  /**
   * Generate a prompt template with context variables
   */
  static generatePrompt(
    template: string,
    context: Record<string, any>
  ): string {
    let prompt = template;
    
    // Replace {{variable}} patterns
    const variablePattern = /\{\{(\w+)\}\}/g;
    prompt = prompt.replace(variablePattern, (match, variableName) => {
      const value = context[variableName];
      return value !== undefined ? String(value) : match;
    });

    // Replace ${variable} patterns
    const dollarPattern = /\$\{(\w+)\}/g;
    prompt = prompt.replace(dollarPattern, (match, variableName) => {
      const value = context[variableName];
      return value !== undefined ? String(value) : match;
    });

    return prompt;
  }

  /**
   * Validate agent configuration
   */
  static validateConfig(config: AgentNodeConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.promptTemplate) {
      errors.push('Prompt template is required');
    }

    if (!config.model) {
      errors.push('Model is required');
    }

    if (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2) {
      errors.push('Temperature must be a number between 0 and 2');
    }

    if (config.maxTokens && (config.maxTokens < 1 || config.maxTokens > 4000)) {
      errors.push('Max tokens must be between 1 and 4000');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get available models
   */
  static getAvailableModels(): string[] {
    return [
      'llama-3.1-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
      'gemma-7b-it',
    ];
  }

  /**
   * Get default configuration
   */
  static getDefaultConfig(): Partial<AgentNodeConfig> {
    return {
      model: 'llama-3.1-70b-versatile',
      temperature: 0.7,
      maxTokens: 1000,
      systemPrompt: 'You are an intelligent agent in a workflow orchestration system.',
    };
  }
}
