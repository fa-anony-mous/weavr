import { WorkflowNode, ExecutionContext, Workflow } from '@/types/workflow';
import { NodeExecutorFactory } from '@/lib/nodes';

export interface ParallelExecutionResult {
  success: boolean;
  results: Array<{
    nodeId: string;
    success: boolean;
    data?: any;
    error?: string;
  }>;
  executionTime: number;
}

export class ParallelExecutor {
  /**
   * Execute multiple nodes in parallel
   */
  static async executeParallel(
    nodes: WorkflowNode[],
    context: ExecutionContext,
    workflow: Workflow,
    triggerData: Record<string, any> = {}
  ): Promise<ParallelExecutionResult> {
    const startTime = Date.now();
    const results: ParallelExecutionResult['results'] = [];

    try {
      // Create execution promises for all nodes
      const executionPromises = nodes.map(async (node) => {
        try {
          const result = await NodeExecutorFactory.executeNode(
            node,
            context,
            workflow,
            triggerData
          );

          return {
            nodeId: node.id,
            success: result.success,
            data: result.data,
            error: result.error,
          };
        } catch (error) {
          return {
            nodeId: node.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      // Wait for all executions to complete
      const nodeResults = await Promise.allSettled(executionPromises);
      
      // Process results
      for (const result of nodeResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            nodeId: 'unknown',
            success: false,
            error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
          });
        }
      }

      const executionTime = Date.now() - startTime;
      const allSuccessful = results.every(r => r.success);

      return {
        success: allSuccessful,
        results,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        success: false,
        results: [{
          nodeId: 'parallel-execution',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }],
        executionTime,
      };
    }
  }

  /**
   * Execute nodes in parallel with a timeout
   */
  static async executeParallelWithTimeout(
    nodes: WorkflowNode[],
    context: ExecutionContext,
    workflow: Workflow,
    timeoutMs: number = 30000,
    triggerData: Record<string, any> = {}
  ): Promise<ParallelExecutionResult> {
    const timeoutPromise = new Promise<ParallelExecutionResult>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Parallel execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const executionPromise = this.executeParallel(nodes, context, workflow, triggerData);

    try {
      return await Promise.race([executionPromise, timeoutPromise]);
    } catch (error) {
      return {
        success: false,
        results: [{
          nodeId: 'parallel-execution',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }],
        executionTime: timeoutMs,
      };
    }
  }

  /**
   * Execute nodes in parallel with concurrency limit
   */
  static async executeParallelWithConcurrencyLimit(
    nodes: WorkflowNode[],
    context: ExecutionContext,
    workflow: Workflow,
    maxConcurrency: number = 5,
    triggerData: Record<string, any> = {}
  ): Promise<ParallelExecutionResult> {
    const startTime = Date.now();
    const results: ParallelExecutionResult['results'] = [];
    
    // Process nodes in batches
    for (let i = 0; i < nodes.length; i += maxConcurrency) {
      const batch = nodes.slice(i, i + maxConcurrency);
      const batchResult = await this.executeParallel(batch, context, workflow, triggerData);
      results.push(...batchResult.results);
    }

    const executionTime = Date.now() - startTime;
    const allSuccessful = results.every(r => r.success);

    return {
      success: allSuccessful,
      results,
      executionTime,
    };
  }

  /**
   * Find independent branches in a workflow that can be executed in parallel
   */
  static findIndependentBranches(
    workflow: Workflow,
    currentNodeId: string
  ): WorkflowNode[][] {
    const branches: WorkflowNode[][] = [];
    const visited = new Set<string>();
    
    // Get all outgoing edges from current node
    const outgoingEdges = workflow.edges.filter(edge => edge.source === currentNodeId);
    
    if (outgoingEdges.length <= 1) {
      return branches; // No parallel branches possible
    }

    // Group edges by their target nodes
    const edgeGroups = new Map<string, string[]>();
    for (const edge of outgoingEdges) {
      if (!edgeGroups.has(edge.target)) {
        edgeGroups.set(edge.target, []);
      }
      edgeGroups.get(edge.target)!.push(edge.source);
    }

    // Find independent paths
    for (const [targetNodeId, sourceNodes] of edgeGroups) {
      if (sourceNodes.length === 1) {
        // This is an independent branch
        const branch = this.traverseBranch(workflow, targetNodeId, visited);
        if (branch.length > 0) {
          branches.push(branch);
        }
      }
    }

    return branches;
  }

  /**
   * Traverse a branch of the workflow
   */
  private static traverseBranch(
    workflow: Workflow,
    startNodeId: string,
    visited: Set<string>
  ): WorkflowNode[] {
    const branch: WorkflowNode[] = [];
    const stack = [startNodeId];

    while (stack.length > 0) {
      const nodeId = stack.pop()!;
      
      if (visited.has(nodeId)) {
        continue;
      }

      visited.add(nodeId);
      const node = workflow.nodes.find(n => n.id === nodeId);
      
      if (node) {
        branch.push(node);
        
        // Add next nodes to stack
        const outgoingEdges = workflow.edges.filter(edge => edge.source === nodeId);
        for (const edge of outgoingEdges) {
          if (!visited.has(edge.target)) {
            stack.push(edge.target);
          }
        }
      }
    }

    return branch;
  }

  /**
   * Check if two nodes can be executed in parallel
   */
  static canExecuteInParallel(
    node1: WorkflowNode,
    node2: WorkflowNode,
    workflow: Workflow
  ): boolean {
    // Check if there's a direct dependency between the nodes
    const hasDirectDependency = workflow.edges.some(edge => 
      (edge.source === node1.id && edge.target === node2.id) ||
      (edge.source === node2.id && edge.target === node1.id)
    );

    if (hasDirectDependency) {
      return false;
    }

    // Check if they share any common dependencies
    const node1Dependencies = this.getNodeDependencies(node1.id, workflow);
    const node2Dependencies = this.getNodeDependencies(node2.id, workflow);
    
    const hasCommonDependency = node1Dependencies.some(dep => 
      node2Dependencies.includes(dep)
    );

    return !hasCommonDependency;
  }

  /**
   * Get all dependencies for a node
   */
  private static getNodeDependencies(nodeId: string, workflow: Workflow): string[] {
    const dependencies: string[] = [];
    const visited = new Set<string>();
    const stack = [nodeId];

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      
      if (visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);
      
      // Find incoming edges
      const incomingEdges = workflow.edges.filter(edge => edge.target === currentId);
      for (const edge of incomingEdges) {
        if (!visited.has(edge.source)) {
          dependencies.push(edge.source);
          stack.push(edge.source);
        }
      }
    }

    return dependencies;
  }
}
