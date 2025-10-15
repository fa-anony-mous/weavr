// Export all node executors
export { TriggerExecutor } from './trigger-executor';
export { ActionExecutor } from './action-executor';
export { AgentExecutor } from './agent-executor';
export { ApprovalExecutor } from './approval-executor';
export { ConditionExecutor } from './condition-executor';
export { LoopExecutor } from './loop-executor';
export { SpawnExecutor } from './spawn-executor';

// Export result types
export type { TriggerResult } from './trigger-executor';
export type { ActionResult } from './action-executor';
export type { AgentResult } from './agent-executor';
export type { ApprovalResult } from './approval-executor';
export type { ConditionResult } from './condition-executor';
export type { LoopResult } from './loop-executor';
export type { SpawnResult } from './spawn-executor';

// Node executor factory
import { WorkflowNode, ExecutionContext, Workflow } from '@/types/workflow';
import { TriggerExecutor } from './trigger-executor';
import { ActionExecutor } from './action-executor';
import { AgentExecutor } from './agent-executor';
import { ApprovalExecutor } from './approval-executor';
import { ConditionExecutor } from './condition-executor';
import { LoopExecutor } from './loop-executor';
import { SpawnExecutor } from './spawn-executor';

export class NodeExecutorFactory {
  private static executors = {
    trigger: new TriggerExecutor(),
    action: new ActionExecutor(),
    agent: new AgentExecutor(),
    'human-approval': new ApprovalExecutor(),
    condition: new ConditionExecutor(),
    loop: new LoopExecutor(),
    'spawn-agent': new SpawnExecutor(),
  };

  static async executeNode(
    node: WorkflowNode,
    context: ExecutionContext,
    workflow?: Workflow,
    triggerData?: Record<string, any>
  ) {
    const executor = this.executors[node.type];
    
    if (!executor) {
      throw new Error(`No executor found for node type: ${node.type}`);
    }

    // Special handling for different node types
    switch (node.type) {
      case 'trigger':
        return (executor as TriggerExecutor).execute(node, context, triggerData);
      case 'spawn-agent':
        if (!workflow) {
          throw new Error('Workflow is required for spawn-agent nodes');
        }
        return (executor as SpawnExecutor).execute(node, context, workflow);
      default:
        return (executor as any).execute(node, context);
    }
  }

  static getExecutor(nodeType: string) {
    return this.executors[nodeType as keyof typeof this.executors];
  }

  static getAllNodeTypes(): string[] {
    return Object.keys(this.executors);
  }
}
