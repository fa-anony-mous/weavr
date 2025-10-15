import { WorkflowNode, ExecutionContext, SpawnAgentNodeConfig, Workflow } from '@/types/workflow';
import { groqClient } from '@/lib/groq-client';
import { redisClient } from '@/lib/redis';

export interface SpawnResult {
  success: boolean;
  data: Record<string, any>;
  error?: string;
  spawnedExecutions: string[];
  aggregatedResult?: any;
}

export class SpawnExecutor {
  async execute(
    node: WorkflowNode,
    context: ExecutionContext,
    workflow: Workflow
  ): Promise<SpawnResult> {
    try {
      const config = node.data.config as SpawnAgentNodeConfig;
      
      // Validate configuration
      const validation = SpawnExecutor.validateConfig(config);
      if (!validation.isValid) {
        throw new Error(`Invalid spawn configuration: ${validation.errors.join(', ')}`);
      }

      // Determine how many agents to spawn
      const agentCount = this.determineAgentCount(config, context);
      
      // Spawn multiple agents
      const spawnPromises = Array.from({ length: agentCount }, (_, index) =>
        this.spawnSingleAgent(node, context, workflow, config, index)
      );

      const spawnResults = await Promise.all(spawnPromises);
      const successfulSpawns = spawnResults.filter(result => result.success);
      const spawnedExecutionIds = successfulSpawns.map(result => result.executionId!);

      if (successfulSpawns.length === 0) {
        return {
          success: false,
          data: {},
          error: 'All agent spawns failed',
          spawnedExecutions: [],
        };
      }

      // Aggregate results based on strategy
      const aggregatedResult = this.aggregateResults(
        successfulSpawns,
        config.aggregationStrategy,
        config.customAggregation
      );

      return {
        success: true,
        data: {
          agentCount: successfulSpawns.length,
          requestedCount: agentCount,
          aggregationStrategy: config.aggregationStrategy,
          aggregatedResult,
          individualResults: successfulSpawns.map(result => result.data),
        },
        spawnedExecutions: spawnedExecutionIds,
        aggregatedResult,
      };
    } catch (error) {
      return {
        success: false,
        data: {},
        error: error instanceof Error ? error.message : 'Unknown error',
        spawnedExecutions: [],
      };
    }
  }

  /**
   * Determine how many agents to spawn
   */
  private determineAgentCount(
    config: SpawnAgentNodeConfig,
    context: ExecutionContext
  ): number {
    // Check if there's a dynamic count in the context
    const dynamicCount = context.variables.agentCount || context.variables.spawnCount;
    
    if (typeof dynamicCount === 'number' && dynamicCount > 0) {
      return Math.min(dynamicCount, config.maxAgents);
    }

    // Use a default count based on context or config
    const defaultCount = Math.min(3, config.maxAgents);
    
    // Check if there's a list to process
    const itemsToProcess = context.variables.items || context.variables.data;
    if (Array.isArray(itemsToProcess)) {
      return Math.min(itemsToProcess.length, config.maxAgents);
    }

    return defaultCount;
  }

  /**
   * Spawn a single agent
   */
  private async spawnSingleAgent(
    node: WorkflowNode,
    context: ExecutionContext,
    workflow: Workflow,
    config: SpawnAgentNodeConfig,
    index: number
  ): Promise<{ success: boolean; executionId?: string; data?: any; error?: string }> {
    try {
      // Create a new execution context for this agent
      const agentExecutionId = `${context.executionId}-agent-${index}`;
      
      // Prepare context for the agent
      const agentContext = {
        ...context.variables,
        stepResults: context.stepResults,
        agentIndex: index,
        totalAgents: config.maxAgents,
        parentExecutionId: context.executionId,
        parentWorkflowId: context.workflowId,
      };

      // Call Groq LLM with the agent prompt
      const response = await groqClient.callGroqAgent(
        config.agentPrompt,
        agentContext,
        {
          model: 'llama-3.1-70b-versatile',
          temperature: 0.7,
          maxTokens: 1000,
        }
      );

      // Parse the response
      let parsedData;
      try {
        parsedData = JSON.parse(response.content);
      } catch {
        parsedData = {
          text: response.content,
          raw: response.content,
          agentIndex: index,
        };
      }

      // Create a simple execution context for this agent
      const agentExecutionContext: ExecutionContext = {
        workflowId: workflow.id,
        executionId: agentExecutionId,
        status: 'completed',
        currentNodeId: node.id,
        stepResults: {
          [node.id]: {
            agentIndex: index,
            result: parsedData,
            timestamp: new Date().toISOString(),
          },
        },
        variables: agentContext,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        parentExecutionId: context.executionId,
        childExecutionIds: [],
        nodeStatuses: {
          [node.id]: 'completed',
        },
        nodeVisitCounts: {
          [node.id]: 1,
        },
      };

      // Save the agent execution
      await redisClient.saveExecution(agentExecutionContext);

      return {
        success: true,
        executionId: agentExecutionId,
        data: {
          agentIndex: index,
          result: parsedData,
          model: response.model,
          usage: response.usage,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Aggregate results from multiple agents
   */
  private aggregateResults(
    spawnResults: Array<{ success: boolean; data?: any; error?: string }>,
    strategy: SpawnAgentNodeConfig['aggregationStrategy'],
    customAggregation?: string
  ): any {
    const results = spawnResults.map(result => result.data?.result || result.data);

    switch (strategy) {
      case 'first':
        return results[0];

      case 'all':
        return results;

      case 'majority':
        return this.aggregateByMajority(results);

      case 'custom':
        if (customAggregation) {
          return this.executeCustomAggregation(results, customAggregation);
        }
        return results;

      default:
        return results;
    }
  }

  /**
   * Aggregate results by majority vote
   */
  private aggregateByMajority(results: any[]): any {
    // Simple majority logic - in practice, you'd want more sophisticated voting
    const resultCounts = new Map<string, number>();
    
    for (const result of results) {
      const key = JSON.stringify(result);
      resultCounts.set(key, (resultCounts.get(key) || 0) + 1);
    }

    let majorityResult = null;
    let maxCount = 0;

    for (const [key, count] of resultCounts) {
      if (count > maxCount) {
        maxCount = count;
        majorityResult = JSON.parse(key);
      }
    }

    return {
      result: majorityResult,
      confidence: maxCount / results.length,
      totalVotes: results.length,
    };
  }

  /**
   * Execute custom aggregation logic
   */
  private executeCustomAggregation(results: any[], customAggregation: string): any {
    try {
      // Create a safe evaluation context
      const safeContext = {
        results,
        count: results.length,
        first: results[0],
        last: results[results.length - 1],
        Math,
        JSON,
        Array,
        Object,
      };

      // Replace variables in the custom aggregation
      let processedAggregation = customAggregation;
      const variablePattern = /\{\{(\w+)\}\}/g;
      processedAggregation = processedAggregation.replace(variablePattern, (match, variableName) => {
        const value = safeContext[variableName as keyof typeof safeContext];
        return value !== undefined ? JSON.stringify(value) : match;
      });

      // Evaluate the custom aggregation
      const contextKeys = Object.keys(safeContext);
      const contextValues = Object.values(safeContext);
      
      const func = new Function(...contextKeys, `return ${processedAggregation}`);
      return func(...contextValues);
    } catch (error) {
      console.error('Error executing custom aggregation:', error);
      return results; // Fallback to returning all results
    }
  }

  /**
   * Wait for all spawned executions to complete
   */
  async waitForSpawnedExecutions(
    spawnedExecutionIds: string[],
    timeoutMs: number = 30000
  ): Promise<ExecutionContext[]> {
    const startTime = Date.now();
    const completedExecutions: ExecutionContext[] = [];

    while (Date.now() - startTime < timeoutMs) {
      const pendingIds = spawnedExecutionIds.filter(id => 
        !completedExecutions.some(exec => exec.executionId === id)
      );

      if (pendingIds.length === 0) {
        break;
      }

      for (const executionId of pendingIds) {
        const execution = await redisClient.getExecution(executionId);
        if (execution && (execution.status === 'completed' || execution.status === 'failed')) {
          completedExecutions.push(execution);
        }
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return completedExecutions;
  }

  /**
   * Validate spawn configuration
   */
  static validateConfig(config: SpawnAgentNodeConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.agentPrompt) {
      errors.push('Agent prompt is required');
    }

    if (!config.maxAgents || config.maxAgents < 1) {
      errors.push('Max agents must be at least 1');
    }

    if (config.maxAgents > 10) {
      errors.push('Max agents cannot exceed 10');
    }

    if (!config.aggregationStrategy) {
      errors.push('Aggregation strategy is required');
    }

    if (config.aggregationStrategy === 'custom' && !config.customAggregation) {
      errors.push('Custom aggregation is required when strategy is custom');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get example aggregation strategies
   */
  static getExampleAggregations(): Record<string, string> {
    return {
      'average': 'results.reduce((sum, r) => sum + (r.value || 0), 0) / results.length',
      'sum': 'results.reduce((sum, r) => sum + (r.value || 0), 0)',
      'max': 'Math.max(...results.map(r => r.value || 0))',
      'min': 'Math.min(...results.map(r => r.value || 0))',
      'concatenate': 'results.map(r => r.text || r).join(" ")',
      'merge_objects': 'Object.assign({}, ...results)',
    };
  }

  /**
   * Get default configuration
   */
  static getDefaultConfig(): Partial<SpawnAgentNodeConfig> {
    return {
      agentPrompt: 'Analyze the given data and provide your insights.',
      maxAgents: 3,
      aggregationStrategy: 'all',
    };
  }
}
