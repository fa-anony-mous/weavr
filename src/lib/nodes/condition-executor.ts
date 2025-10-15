import { WorkflowNode, ExecutionContext, ConditionNodeConfig } from '@/types/workflow';

export interface ConditionResult {
  success: boolean;
  data: Record<string, any>;
  error?: string;
  result: boolean;
  evaluatedExpression: string;
}

export class ConditionExecutor {
  async execute(
    node: WorkflowNode,
    context: ExecutionContext
  ): Promise<ConditionResult> {
    try {
      const config = node.data.config as ConditionNodeConfig;
      
      // Validate configuration
      const validation = ConditionExecutor.validateConfig(config);
      if (!validation.isValid) {
        throw new Error(`Invalid condition configuration: ${validation.errors.join(', ')}`);
      }

      // Evaluate the condition expression
      const result = this.evaluateCondition(config.expression, context);

      return {
        success: true,
        data: {
          condition: config.expression,
          result,
          evaluatedAt: new Date().toISOString(),
          context: this.sanitizeContext(context),
        },
        result,
        evaluatedExpression: config.expression,
      };
    } catch (error) {
      return {
        success: false,
        data: {},
        error: error instanceof Error ? error.message : 'Unknown error',
        result: false,
        evaluatedExpression: '',
      };
    }
  }

  /**
   * Evaluate a condition expression safely
   */
  private evaluateCondition(expression: string, context: ExecutionContext): boolean {
    try {
      // Create a safe evaluation context
      const safeContext = this.createSafeContext(context);
      
      // Replace variables in the expression
      const processedExpression = this.replaceVariables(expression, safeContext);
      
      // Evaluate the expression
      // Note: In production, you'd want to use a proper expression evaluator
      // like expr-eval or similar for security
      const result = this.safeEval(processedExpression, safeContext);
      
      return Boolean(result);
    } catch (error) {
      console.error('Error evaluating condition:', error);
      return false;
    }
  }

  /**
   * Create a safe evaluation context
   */
  private createSafeContext(context: ExecutionContext): Record<string, any> {
    return {
      // Execution context
      executionId: context.executionId,
      workflowId: context.workflowId,
      status: context.status,
      
      // Variables
      ...context.variables,
      
      // Step results
      ...context.stepResults,
      
      // Utility functions
      now: () => new Date(),
      timestamp: Date.now(),
      
      // Math functions
      Math: Math,
      
      // String functions
      String: String,
      Number: Number,
      Boolean: Boolean,
      
      // Array functions
      Array: Array,
      
      // Object functions
      Object: Object,
      
      // JSON functions
      JSON: JSON,
    };
  }

  /**
   * Replace variables in expression with context values
   */
  private replaceVariables(expression: string, context: Record<string, any>): string {
    let processedExpression = expression;
    
    // Replace {{variable}} patterns
    const variablePattern = /\{\{(\w+)\}\}/g;
    processedExpression = processedExpression.replace(variablePattern, (match, variableName) => {
      const value = context[variableName];
      return value !== undefined ? JSON.stringify(value) : match;
    });

    // Replace ${variable} patterns
    const dollarPattern = /\$\{(\w+)\}/g;
    processedExpression = processedExpression.replace(dollarPattern, (match, variableName) => {
      const value = context[variableName];
      return value !== undefined ? JSON.stringify(value) : match;
    });

    return processedExpression;
  }

  /**
   * Safely evaluate JavaScript expression
   * Note: This is a simplified implementation. In production, use a proper expression evaluator
   */
  private safeEval(expression: string, context: Record<string, any>): any {
    // Basic safety checks
    if (this.containsUnsafeCode(expression)) {
      throw new Error('Expression contains unsafe code');
    }

    try {
      // Create a function with the context as parameters
      const contextKeys = Object.keys(context);
      const contextValues = Object.values(context);
      
      // Create a function that evaluates the expression
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
   * Sanitize context for logging (remove sensitive data)
   */
  private sanitizeContext(context: ExecutionContext): Record<string, any> {
    const sanitized = { ...context };
    
    // Remove potentially sensitive data
    delete sanitized.variables?.password;
    delete sanitized.variables?.token;
    delete sanitized.variables?.secret;
    delete sanitized.variables?.key;
    
    return sanitized;
  }

  /**
   * Get the next nodes based on condition result
   */
  getNextNodes(
    node: WorkflowNode,
    workflow: { nodes: WorkflowNode[]; edges: any[] },
    conditionResult: boolean
  ): WorkflowNode[] {
    const outgoingEdges = workflow.edges.filter(edge => edge.source === node.id);
    
    if (conditionResult) {
      // Find edges with condition that evaluates to true, or no condition
      const trueEdges = outgoingEdges.filter(edge => 
        !edge.condition || edge.condition === 'true' || edge.condition === 'True'
      );
      return trueEdges.map(edge => 
        workflow.nodes.find(n => n.id === edge.target)
      ).filter(Boolean) as WorkflowNode[];
    } else {
      // Find edges with condition that evaluates to false
      const falseEdges = outgoingEdges.filter(edge => 
        edge.condition === 'false' || edge.condition === 'False'
      );
      return falseEdges.map(edge => 
        workflow.nodes.find(n => n.id === edge.target)
      ).filter(Boolean) as WorkflowNode[];
    }
  }

  /**
   * Validate condition configuration
   */
  static validateConfig(config: ConditionNodeConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.expression) {
      errors.push('Expression is required');
    }

    if (config.expression && config.expression.trim().length === 0) {
      errors.push('Expression cannot be empty');
    }

    // Basic syntax validation
    if (config.expression) {
      try {
        // Try to parse as a simple expression
        const testContext = { test: true };
        const testExpression = config.expression.replace(/\{\{(\w+)\}\}/g, 'true');
        new Function('test', `return ${testExpression}`)(testContext);
      } catch (error) {
        errors.push(`Invalid expression syntax: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get example expressions
   */
  static getExampleExpressions(): string[] {
    return [
      '{{amount}} > 1000',
      '{{status}} === "approved"',
      '{{user.role}} === "admin"',
      '{{items.length}} > 0',
      '{{score}} >= 80 && {{attempts}} < 3',
      '{{date}} > new Date("2024-01-01")',
      '{{type}} === "urgent" || {{priority}} === "high"',
    ];
  }

  /**
   * Get default configuration
   */
  static getDefaultConfig(): Partial<ConditionNodeConfig> {
    return {
      expression: '{{value}} === true',
      trueLabel: 'Yes',
      falseLabel: 'No',
    };
  }
}
