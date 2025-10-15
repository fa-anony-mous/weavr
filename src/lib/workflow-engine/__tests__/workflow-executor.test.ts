import { WorkflowExecutor } from '../executor';
import { Workflow, WorkflowNode, WorkflowEdge } from '@/types/workflow';

// Mock Redis client
jest.mock('@/lib/redis', () => ({
  redisClient: {
    saveExecution: jest.fn(),
    getExecution: jest.fn(),
    updateExecution: jest.fn(),
  },
}));

// Mock node executors
jest.mock('@/lib/nodes', () => ({
  NodeExecutorFactory: {
    executeNode: jest.fn(),
  },
}));

describe('WorkflowExecutor', () => {
  let executor: WorkflowExecutor;
  let mockWorkflow: Workflow;

  beforeEach(() => {
    executor = new WorkflowExecutor();
    
    mockWorkflow = {
      id: 'test-workflow',
      name: 'Test Workflow',
      description: 'A test workflow',
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger',
          data: { label: 'Start', config: {} },
          position: { x: 0, y: 0 },
        },
        {
          id: 'action-1',
          type: 'action',
          data: { label: 'Process Data', config: {} },
          position: { x: 100, y: 0 },
        },
        {
          id: 'agent-1',
          type: 'agent',
          data: { label: 'AI Analysis', config: {} },
          position: { x: 200, y: 0 },
        },
      ],
      edges: [
        { id: 'edge-1', source: 'trigger-1', target: 'action-1' },
        { id: 'edge-2', source: 'action-1', target: 'agent-1' },
      ],
      metadata: {
        createdAt: new Date().toISOString(),
        version: 1,
      },
    };
  });

  describe('executeWorkflow', () => {
    it('should execute a simple linear workflow', async () => {
      const { NodeExecutorFactory } = require('@/lib/nodes');
      
      // Mock successful node executions
      NodeExecutorFactory.executeNode
        .mockResolvedValueOnce({ success: true, data: { triggerData: 'test' } })
        .mockResolvedValueOnce({ success: true, data: { processed: true } })
        .mockResolvedValueOnce({ success: true, data: { analysis: 'complete' } });

      const result = await executor.executeWorkflow(mockWorkflow, { test: 'data' });

      expect(result.success).toBe(true);
      expect(result.executionId).toBeDefined();
      expect(result.status).toBe('completed');
      expect(NodeExecutorFactory.executeNode).toHaveBeenCalledTimes(3);
    });

    it('should handle workflow execution errors', async () => {
      const { NodeExecutorFactory } = require('@/lib/nodes');
      
      // Mock node execution failure
      NodeExecutorFactory.executeNode
        .mockResolvedValueOnce({ success: true, data: { triggerData: 'test' } })
        .mockRejectedValueOnce(new Error('Node execution failed'));

      const result = await executor.executeWorkflow(mockWorkflow, { test: 'data' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Node execution failed');
    });

    it('should validate workflow before execution', async () => {
      const invalidWorkflow = {
        ...mockWorkflow,
        nodes: [], // Empty nodes array
      };

      const result = await executor.executeWorkflow(invalidWorkflow, { test: 'data' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No trigger node found');
    });
  });

  describe('validateWorkflow', () => {
    it('should validate a correct workflow', () => {
      const result = executor.validateWorkflow(mockWorkflow);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing trigger node', () => {
      const workflowWithoutTrigger = {
        ...mockWorkflow,
        nodes: mockWorkflow.nodes.filter(n => n.type !== 'trigger'),
      };

      const result = executor.validateWorkflow(workflowWithoutTrigger);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No trigger node found');
    });

    it('should detect orphaned nodes', () => {
      const workflowWithOrphanedNode = {
        ...mockWorkflow,
        nodes: [
          ...mockWorkflow.nodes,
          {
            id: 'orphan-1',
            type: 'action',
            data: { label: 'Orphaned', config: {} },
            position: { x: 300, y: 0 },
          },
        ],
      };

      const result = executor.validateWorkflow(workflowWithOrphanedNode);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Node orphan-1 is not connected to the workflow');
    });

    it('should detect cycles in workflow', () => {
      const cyclicWorkflow = {
        ...mockWorkflow,
        edges: [
          ...mockWorkflow.edges,
          { id: 'edge-3', source: 'agent-1', target: 'action-1' }, // Creates a cycle
        ],
      };

      const result = executor.validateWorkflow(cyclicWorkflow);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cycle detected in workflow');
    });
  });

  describe('getNextNodes', () => {
    it('should return next nodes for a given node', async () => {
      const context = {
        workflowId: 'test-workflow',
        executionId: 'test-execution',
        status: 'running' as const,
        currentNodeId: 'trigger-1',
        stepResults: {},
        variables: {},
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const nextNodes = await executor.getNextNodes('trigger-1', context);
      expect(nextNodes).toHaveLength(1);
      expect(nextNodes[0].id).toBe('action-1');
    });

    it('should handle conditional edges', async () => {
      const workflowWithCondition = {
        ...mockWorkflow,
        edges: [
          { id: 'edge-1', source: 'trigger-1', target: 'action-1' },
          { id: 'edge-2', source: 'action-1', target: 'agent-1', condition: '{{success}} === true' },
        ],
      };

      const context = {
        workflowId: 'test-workflow',
        executionId: 'test-execution',
        status: 'running' as const,
        currentNodeId: 'action-1',
        stepResults: {
          'action-1': { success: true },
        },
        variables: { success: true },
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const nextNodes = await executor.getNextNodes('action-1', context);
      expect(nextNodes).toHaveLength(1);
      expect(nextNodes[0].id).toBe('agent-1');
    });
  });

  describe('pauseForApproval', () => {
    it('should pause execution for human approval', async () => {
      const context = {
        workflowId: 'test-workflow',
        executionId: 'test-execution',
        status: 'running' as const,
        currentNodeId: 'approval-1',
        stepResults: {},
        variables: {},
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await executor.pauseForApproval('test-execution');
      expect(result.success).toBe(true);
    });
  });

  describe('resumeExecution', () => {
    it('should resume a paused execution', async () => {
      const context = {
        workflowId: 'test-workflow',
        executionId: 'test-execution',
        status: 'paused' as const,
        currentNodeId: 'approval-1',
        stepResults: {},
        variables: {},
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await executor.resumeExecution('test-execution', { approved: true });
      expect(result.success).toBe(true);
    });
  });
});
