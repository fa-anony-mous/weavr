import { 
  Workflow, 
  WorkflowNode, 
  WorkflowEdge, 
  ExecutionContext, 
  ExecutionStatus,
  NodeStatus 
} from '@/types/workflow';
import { NodeExecutorFactory } from '@/lib/nodes';
import { redisClient } from '@/lib/redis';
import { LoopExecutor } from '@/lib/nodes/loop-executor';
import { ConditionExecutor } from '@/lib/nodes/condition-executor';

export interface ExecutionOptions {
  maxIterations?: number;
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export interface ExecutionResult {
  success: boolean;
  executionId: string;
  status: ExecutionStatus;
  error?: string;
  duration: number;
  stepsExecuted: number;
}

export class WorkflowExecutor {
  private options: Required<ExecutionOptions>;

  constructor(options: ExecutionOptions = {}) {
    this.options = {
      maxIterations: options.maxIterations || 1000,
      timeoutMs: options.timeoutMs || 300000, // 5 minutes
      retryAttempts: options.retryAttempts || 3,
      retryDelayMs: options.retryDelayMs || 1000,
    };
  }

  /**
   * Execute a workflow with the given input
   */
  async executeWorkflow(
    workflow: Workflow,
    input: Record<string, any> = {},
    executionId?: string
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executionIdFinal = executionId || this.generateExecutionId();
    
    try {
      // Create execution context
      const context: ExecutionContext = {
        workflowId: workflow.id,
        executionId: executionIdFinal,
        status: 'running',
        currentNodeId: null,
        stepResults: {},
        variables: { ...input },
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        nodeStatuses: {},
        nodeVisitCounts: {},
        childExecutionIds: [],
      };

      // Save initial execution state
      await redisClient.saveExecution(context);

      // Find the starting node (trigger node)
      const startNode = this.findStartNode(workflow);
      if (!startNode) {
        throw new Error('No trigger node found in workflow');
      }

      // Execute the workflow
      const result = await this.executeFromNode(workflow, context, startNode, input);

      const duration = Date.now() - startTime;
      
      return {
        success: result.success,
        executionId: executionIdFinal,
        status: result.status,
        error: result.error,
        duration,
        stepsExecuted: Object.keys(result.stepResults).length,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update execution status to failed
      if (executionId) {
        await redisClient.updateExecutionStatus(executionId, 'failed', {
          error: errorMessage,
          completedAt: new Date().toISOString(),
        });
      }

      return {
        success: false,
        executionId: executionIdFinal,
        status: 'failed',
        error: errorMessage,
        duration,
        stepsExecuted: 0,
      };
    }
  }

  /**
   * Execute workflow starting from a specific node
   */
  private async executeFromNode(
    workflow: Workflow,
    context: ExecutionContext,
    startNode: WorkflowNode,
    triggerData: Record<string, any> = {}
  ): Promise<{ success: boolean; status: ExecutionStatus; error?: string; stepResults: Record<string, any> }> {
    const visited = new Set<string>();
    const executionStack: WorkflowNode[] = [startNode];
    let currentNode: WorkflowNode | undefined;

    try {
      while (executionStack.length > 0 && context.status === 'running') {
        currentNode = executionStack.shift()!;
        
        // Check for infinite loops
        if (visited.has(currentNode.id)) {
          const visitCount = context.nodeVisitCounts[currentNode.id] || 0;
          if (visitCount >= this.options.maxIterations) {
            throw new Error(`Maximum iterations (${this.options.maxIterations}) exceeded for node ${currentNode.id}`);
          }
        }

        visited.add(currentNode.id);
        context.nodeVisitCounts[currentNode.id] = (context.nodeVisitCounts[currentNode.id] || 0) + 1;
        context.currentNodeId = currentNode.id;

        // Update node status
        context.nodeStatuses[currentNode.id] = 'running';
        await redisClient.saveExecution(context);

        // Execute the current node
        const nodeResult = await this.executeNode(workflow, context, currentNode, triggerData);

        if (!nodeResult.success) {
          context.status = 'failed';
          context.error = nodeResult.error;
          context.nodeStatuses[currentNode.id] = 'failed';
          break;
        }

        // Store the result
        context.stepResults[currentNode.id] = nodeResult.data;
        context.nodeStatuses[currentNode.id] = 'completed';

        // Handle special node types
        if (currentNode.type === 'human-approval') {
          context.status = 'paused';
          break; // Wait for human approval
        }

        if (currentNode.type === 'loop') {
          const loopResult = nodeResult.data as any;
          if (loopResult.shouldContinue) {
            // Continue the loop - add current node back to stack
            executionStack.unshift(currentNode);
            continue;
          }
        }

        // Get next nodes
        const nextNodes = this.getNextNodes(workflow, currentNode, context);
        
        // Handle conditional branching
        if (currentNode.type === 'condition') {
          const conditionResult = nodeResult.data as any;
          const conditionalNextNodes = this.getConditionalNextNodes(
            workflow, 
            currentNode, 
            conditionResult.result
          );
          executionStack.unshift(...conditionalNextNodes);
        } else {
          executionStack.unshift(...nextNodes);
        }

        // Update context
        context.updatedAt = new Date().toISOString();
        await redisClient.saveExecution(context);
      }

      // Mark execution as completed if no more nodes to process
      if (context.status === 'running' && executionStack.length === 0) {
        context.status = 'completed';
        context.completedAt = new Date().toISOString();
        await redisClient.saveExecution(context);
      }

      return {
        success: context.status !== 'failed',
        status: context.status,
        error: context.error,
        stepResults: context.stepResults,
      };
    } catch (error) {
      context.status = 'failed';
      context.error = error instanceof Error ? error.message : 'Unknown error';
      context.nodeStatuses[currentNode?.id || 'unknown'] = 'failed';
      await redisClient.saveExecution(context);

      return {
        success: false,
        status: 'failed',
        error: context.error,
        stepResults: context.stepResults,
      };
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    workflow: Workflow,
    context: ExecutionContext,
    node: WorkflowNode,
    triggerData: Record<string, any> = {}
  ): Promise<{ success: boolean; data: any; error?: string }> {
    try {
      const result = await NodeExecutorFactory.executeNode(
        node,
        context,
        workflow,
        triggerData
      );

      return {
        success: result.success,
        data: result.data,
        error: result.error,
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
   * Get the next nodes to execute
   */
  private getNextNodes(
    workflow: Workflow,
    currentNode: WorkflowNode,
    context: ExecutionContext
  ): WorkflowNode[] {
    const outgoingEdges = workflow.edges.filter(edge => edge.source === currentNode.id);
    
    return outgoingEdges
      .map(edge => workflow.nodes.find(node => node.id === edge.target))
      .filter((node): node is WorkflowNode => node !== undefined);
  }

  /**
   * Get next nodes based on condition result
   */
  private getConditionalNextNodes(
    workflow: Workflow,
    conditionNode: WorkflowNode,
    conditionResult: boolean
  ): WorkflowNode[] {
    const outgoingEdges = workflow.edges.filter(edge => edge.source === conditionNode.id);
    
    if (conditionResult) {
      // Find edges with condition that evaluates to true, or no condition
      const trueEdges = outgoingEdges.filter(edge => 
        !edge.condition || edge.condition === 'true' || edge.condition === 'True'
      );
      return trueEdges
        .map(edge => workflow.nodes.find(node => node.id === edge.target))
        .filter((node): node is WorkflowNode => node !== undefined);
    } else {
      // Find edges with condition that evaluates to false
      const falseEdges = outgoingEdges.filter(edge => 
        edge.condition === 'false' || edge.condition === 'False'
      );
      return falseEdges
        .map(edge => workflow.nodes.find(node => node.id === edge.target))
        .filter((node): node is WorkflowNode => node !== undefined);
    }
  }

  /**
   * Find the starting node (trigger node)
   */
  private findStartNode(workflow: Workflow): WorkflowNode | undefined {
    return workflow.nodes.find(node => node.type === 'trigger');
  }

  /**
   * Resume a paused execution
   */
  async resumeExecution(
    executionId: string,
    approvalData?: Record<string, any>
  ): Promise<ExecutionResult> {
    const context = await redisClient.getExecution(executionId);
    if (!context) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (context.status !== 'paused') {
      throw new Error(`Execution ${executionId} is not paused`);
    }

    // Update context with approval data
    if (approvalData) {
      context.variables = { ...context.variables, ...approvalData };
    }

    // Get the workflow
    const workflow = await redisClient.getWorkflow(context.workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${context.workflowId} not found`);
    }

    // Resume execution
    context.status = 'running';
    context.updatedAt = new Date().toISOString();
    await redisClient.saveExecution(context);

    // Continue from the current node
    const currentNode = workflow.nodes.find(node => node.id === context.currentNodeId);
    if (!currentNode) {
      throw new Error(`Current node ${context.currentNodeId} not found`);
    }

    const result = await this.executeFromNode(workflow, context, currentNode);
    
    return {
      success: result.success,
      executionId,
      status: result.status,
      error: result.error,
      duration: 0, // Will be calculated by caller
      stepsExecuted: Object.keys(result.stepResults).length,
    };
  }

  /**
   * Cancel an execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    try {
      await redisClient.updateExecutionStatus(executionId, 'cancelled', {
        completedAt: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error('Error cancelling execution:', error);
      return false;
    }
  }

  /**
   * Get execution status
   */
  async getExecutionStatus(executionId: string): Promise<ExecutionContext | null> {
    return await redisClient.getExecution(executionId);
  }

  /**
   * Validate workflow before execution
   */
  static validateWorkflow(workflow: Workflow): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for trigger node
    const triggerNodes = workflow.nodes.filter(node => node.type === 'trigger');
    if (triggerNodes.length === 0) {
      errors.push('Workflow must have at least one trigger node');
    }

    // Check for orphaned nodes
    const nodeIds = new Set(workflow.nodes.map(node => node.id));
    const connectedNodeIds = new Set<string>();
    
    for (const edge of workflow.edges) {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    }

    for (const nodeId of nodeIds) {
      if (!connectedNodeIds.has(nodeId) && workflow.nodes.find(n => n.id === nodeId)?.type !== 'trigger') {
        errors.push(`Node ${nodeId} is not connected to the workflow`);
      }
    }

    // Check for cycles (optional - some workflows might be intentionally cyclic)
    const cycles = LoopExecutor.detectCycles(workflow);
    if (cycles.length > 0) {
      console.warn('Workflow contains cycles:', cycles);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate a unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
