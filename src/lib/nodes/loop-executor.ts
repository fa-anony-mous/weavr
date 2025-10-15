import { WorkflowNode, ExecutionContext, LoopNodeConfig } from '@/types/workflow';

export interface LoopResult {
  success: boolean;
  data: Record<string, any>;
  error?: string;
  shouldContinue: boolean;
  iterationCount: number;
  exitReason?: string;
}

export class LoopExecutor {
  async execute(
    node: WorkflowNode,
    context: ExecutionContext
  ): Promise<LoopResult> {
    try {
      const config = node.data.config as LoopNodeConfig;
      
      // Validate configuration
      const validation = LoopExecutor.validateConfig(config);
      if (!validation.isValid) {
        throw new Error(`Invalid loop configuration: ${validation.errors.join(', ')}`);
      }

      // Get current iteration count
      const currentIteration = context.nodeVisitCounts[node.id] || 0;
      const newIterationCount = currentIteration + 1;

      // Check if we've exceeded max iterations
      if (newIterationCount > config.maxIterations) {
        return {
          success: true,
          data: {
            iterationCount: newIterationCount,
            maxIterations: config.maxIterations,
            exitReason: 'max_iterations_reached',
          },
          shouldContinue: false,
          iterationCount: newIterationCount,
          exitReason: 'Maximum iterations reached',
        };
      }

      // Check exit condition if provided
      if (config.exitCondition) {
        const shouldExit = this.evaluateExitCondition(
          config.exitCondition,
          context,
          newIterationCount
        );

        if (shouldExit) {
          return {
            success: true,
            data: {
              iterationCount: newIterationCount,
              exitReason: 'condition_met',
              exitCondition: config.exitCondition,
            },
            shouldContinue: false,
            iterationCount: newIterationCount,
            exitReason: 'Exit condition met',
          };
        }
      }

      // Update loop variable if specified
      const updatedVariables = { ...context.variables };
      if (config.loopVariable) {
        updatedVariables[config.loopVariable] = newIterationCount;
      }

      return {
        success: true,
        data: {
          iterationCount: newIterationCount,
          maxIterations: config.maxIterations,
          loopVariable: config.loopVariable,
          loopVariableValue: config.loopVariable ? updatedVariables[config.loopVariable] : undefined,
          shouldContinue: true,
        },
        shouldContinue: true,
        iterationCount: newIterationCount,
      };
    } catch (error) {
      return {
        success: false,
        data: {},
        error: error instanceof Error ? error.message : 'Unknown error',
        shouldContinue: false,
        iterationCount: 0,
      };
    }
  }

  /**
   * Evaluate exit condition for the loop
   */
  private evaluateExitCondition(
    condition: string,
    context: ExecutionContext,
    iterationCount: number
  ): boolean {
    try {
      // Create a safe evaluation context
      const safeContext = {
        ...context.variables,
        ...context.stepResults,
        iteration: iterationCount,
        loopCount: iterationCount,
        currentIteration: iterationCount,
      };

      // Replace variables in the condition
      const processedCondition = this.replaceVariables(condition, safeContext);

      // Evaluate the condition
      const result = this.safeEval(processedCondition, safeContext);
      
      return Boolean(result);
    } catch (error) {
      console.error('Error evaluating loop exit condition:', error);
      return false;
    }
  }

  /**
   * Replace variables in condition with context values
   */
  private replaceVariables(condition: string, context: Record<string, any>): string {
    let processedCondition = condition;
    
    // Replace {{variable}} patterns
    const variablePattern = /\{\{(\w+)\}\}/g;
    processedCondition = processedCondition.replace(variablePattern, (match, variableName) => {
      const value = (context as any)[variableName];
      return value !== undefined ? JSON.stringify(value) : match;
    });

    // Replace ${variable} patterns
    const dollarPattern = /\$\{(\w+)\}/g;
    processedCondition = processedCondition.replace(dollarPattern, (match, variableName) => {
      const value = (context as any)[variableName];
      return value !== undefined ? JSON.stringify(value) : match;
    });

    return processedCondition;
  }

  /**
   * Safely evaluate JavaScript expression
   */
  private safeEval(expression: string, context: Record<string, any>): any {
    // Basic safety checks
    if (this.containsUnsafeCode(expression)) {
      throw new Error('Expression contains unsafe code');
    }

    try {
      const contextKeys = Object.keys(context);
      const contextValues = Object.values(context);
      
      const func = new Function(...contextKeys, `return ${expression}`);
      return func(...contextValues);
    } catch (error) {
      throw new Error(`Expression evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if expression contains unsafe code
   */
  private containsUnsafeCode(expression: string): boolean {
    const unsafePatterns = [
      /require\s*\(/,
      /import\s+/,
      /eval\s*\(/,
      /Function\s*\(/,
      /setTimeout\s*\(/,
      /setInterval\s*\(/,
      /process\./,
      /global\./,
      /window\./,
      /document\./,
      /console\./,
      /__proto__/,
      /constructor/,
      /prototype/,
    ];

    return unsafePatterns.some(pattern => pattern.test(expression));
  }

  /**
   * Get the next nodes based on loop result
   */
  getNextNodes(
    node: WorkflowNode,
    workflow: { nodes: WorkflowNode[]; edges: any[] },
    shouldContinue: boolean
  ): WorkflowNode[] {
    const outgoingEdges = workflow.edges.filter(edge => edge.source === node.id);
    
    if (shouldContinue) {
      // Find edges that continue the loop (usually back to the loop start)
      const continueEdges = outgoingEdges.filter(edge => 
        edge.condition === 'continue' || edge.condition === 'true' || !edge.condition
      );
      return continueEdges.map(edge => 
        workflow.nodes.find(n => n.id === edge.target)
      ).filter(Boolean) as WorkflowNode[];
    } else {
      // Find edges that exit the loop
      const exitEdges = outgoingEdges.filter(edge => 
        edge.condition === 'exit' || edge.condition === 'false'
      );
      return exitEdges.map(edge => 
        workflow.nodes.find(n => n.id === edge.target)
      ).filter(Boolean) as WorkflowNode[];
    }
  }

  /**
   * Check if a node is part of a loop
   */
  static isNodeInLoop(
    nodeId: string,
    workflow: { nodes: WorkflowNode[]; edges: any[] }
  ): boolean {
    const visited = new Set<string>();
    const stack = [nodeId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      
      if (visited.has(current)) {
        return true; // Found a cycle
      }
      
      visited.add(current);
      
      // Find nodes that this node connects to
      const outgoingEdges = workflow.edges.filter(edge => edge.source === current);
      const targetNodes = outgoingEdges.map(edge => edge.target);
      
      stack.push(...targetNodes);
    }

    return false;
  }

  /**
   * Detect cycles in workflow
   */
  static detectCycles(workflow: { nodes: WorkflowNode[]; edges: any[] }): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): void => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        cycles.push(path.slice(cycleStart));
        return;
      }

      if (visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const outgoingEdges = workflow.edges.filter(edge => edge.source === nodeId);
      for (const edge of outgoingEdges) {
        dfs(edge.target, [...path, nodeId]);
      }

      recursionStack.delete(nodeId);
    };

    for (const node of workflow.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return cycles;
  }

  /**
   * Validate loop configuration
   */
  static validateConfig(config: LoopNodeConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.maxIterations || config.maxIterations < 1) {
      errors.push('Max iterations must be at least 1');
    }

    if (config.maxIterations > 1000) {
      errors.push('Max iterations cannot exceed 1000');
    }

    if (config.exitCondition && config.exitCondition.trim().length === 0) {
      errors.push('Exit condition cannot be empty if provided');
    }

    // Validate exit condition syntax
    if (config.exitCondition) {
      try {
        const testContext = { iteration: 1, test: true };
        const testExpression = config.exitCondition.replace(/\{\{(\w+)\}\}/g, 'true');
        new Function('iteration', 'test', `return ${testExpression}`)(1, true);
      } catch (error) {
        errors.push(`Invalid exit condition syntax: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get example exit conditions
   */
  static getExampleExitConditions(): string[] {
    return [
      '{{iteration}} >= 5',
      '{{status}} === "completed"',
      '{{items.length}} === 0',
      '{{error}} !== null',
      '{{score}} >= 100',
      '{{attempts}} >= 3 && {{success}} === false',
    ];
  }

  /**
   * Get default configuration
   */
  static getDefaultConfig(): Partial<LoopNodeConfig> {
    return {
      maxIterations: 10,
      loopVariable: 'iteration',
    };
  }
}
