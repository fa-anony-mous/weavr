import { Workflow } from '@/types/workflow';

/**
 * Example workflows showcasing different patterns and capabilities
 */

export const exampleWorkflows: Workflow[] = [
  // 1. Simple Linear Workflow
  {
    id: 'simple-linear',
    name: 'Simple Linear Workflow',
    description: 'A basic linear workflow with trigger, action, and agent nodes',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        data: {
          label: 'Start Process',
          config: {
            triggerType: 'manual',
            description: 'Manual trigger to start the workflow',
          },
        },
        position: { x: 100, y: 100 },
      },
      {
        id: 'action-1',
        type: 'action',
        data: {
          label: 'Process Data',
          config: {
            actionType: 'data-transform',
            transformScript: 'JSON.stringify({ processed: true, input: {{input}} })',
          },
        },
        position: { x: 300, y: 100 },
      },
      {
        id: 'agent-1',
        type: 'agent',
        data: {
          label: 'AI Analysis',
          config: {
            prompt: 'Analyze the following data and provide insights: {{processedData}}',
            model: 'llama-3.1-70b-versatile',
            temperature: 0.7,
          },
        },
        position: { x: 500, y: 100 },
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
  },

  // 2. Conditional Branching Workflow
  {
    id: 'conditional-branching',
    name: 'Conditional Branching Workflow',
    description: 'Workflow with conditional logic and branching paths',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        data: {
          label: 'Order Received',
          config: {
            triggerType: 'webhook',
            description: 'Webhook trigger for new orders',
          },
        },
        position: { x: 100, y: 100 },
      },
      {
        id: 'condition-1',
        type: 'condition',
        data: {
          label: 'Check Amount',
          config: {
            condition: '{{orderAmount}} > 1000',
            trueLabel: 'High Value',
            falseLabel: 'Standard',
          },
        },
        position: { x: 300, y: 100 },
      },
      {
        id: 'action-1',
        type: 'action',
        data: {
          label: 'Standard Processing',
          config: {
            actionType: 'notification',
            message: 'Processing standard order for {{customerName}}',
          },
        },
        position: { x: 500, y: 50 },
      },
      {
        id: 'approval-1',
        type: 'human-approval',
        data: {
          label: 'Manager Approval',
          config: {
            message: 'High-value order requires manager approval',
            approvers: ['manager@company.com'],
            timeout: 3600, // 1 hour
          },
        },
        position: { x: 500, y: 150 },
      },
      {
        id: 'action-2',
        type: 'action',
        data: {
          label: 'Process Order',
          config: {
            actionType: 'http-request',
            httpUrl: 'https://api.company.com/orders/process',
            httpMethod: 'POST',
          },
        },
        position: { x: 700, y: 100 },
      },
    ],
    edges: [
      { id: 'edge-1', source: 'trigger-1', target: 'condition-1' },
      { id: 'edge-2', source: 'condition-1', target: 'action-1', condition: '{{orderAmount}} <= 1000' },
      { id: 'edge-3', source: 'condition-1', target: 'approval-1', condition: '{{orderAmount}} > 1000' },
      { id: 'edge-4', source: 'action-1', target: 'action-2' },
      { id: 'edge-5', source: 'approval-1', target: 'action-2' },
    ],
    metadata: {
      createdAt: new Date().toISOString(),
      version: 1,
    },
  },

  // 3. Cyclic Loop Workflow
  {
    id: 'cyclic-loop',
    name: 'Cyclic Loop Workflow',
    description: 'Workflow with a loop for iterative processing',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        data: {
          label: 'Start Batch',
          config: {
            triggerType: 'manual',
            description: 'Start batch processing',
          },
        },
        position: { x: 100, y: 100 },
      },
      {
        id: 'loop-1',
        type: 'loop',
        data: {
          label: 'Process Items',
          config: {
            maxIterations: 10,
            loopVariable: 'iteration',
            exitCondition: '{{processedCount}} >= {{totalItems}}',
          },
        },
        position: { x: 300, y: 100 },
      },
      {
        id: 'agent-1',
        type: 'agent',
        data: {
          label: 'Analyze Item',
          config: {
            prompt: 'Analyze item {{currentItem}} and determine if it needs special handling',
            model: 'llama-3.1-70b-versatile',
            temperature: 0.3,
          },
        },
        position: { x: 500, y: 100 },
      },
      {
        id: 'action-1',
        type: 'action',
        data: {
          label: 'Update Progress',
          config: {
            actionType: 'data-transform',
            transformScript: 'JSON.stringify({ processedCount: {{iteration}} + 1, currentItem: {{itemList}}[{{iteration}}] })',
          },
        },
        position: { x: 700, y: 100 },
      },
      {
        id: 'action-2',
        type: 'action',
        data: {
          label: 'Complete Batch',
          config: {
            actionType: 'notification',
            message: 'Batch processing completed. Processed {{processedCount}} items.',
          },
        },
        position: { x: 500, y: 200 },
      },
    ],
    edges: [
      { id: 'edge-1', source: 'trigger-1', target: 'loop-1' },
      { id: 'edge-2', source: 'loop-1', target: 'agent-1' },
      { id: 'edge-3', source: 'agent-1', target: 'action-1' },
      { id: 'edge-4', source: 'action-1', target: 'loop-1' }, // Loop back
      { id: 'edge-5', source: 'loop-1', target: 'action-2', condition: '{{processedCount}} >= {{totalItems}}' },
    ],
    metadata: {
      createdAt: new Date().toISOString(),
      version: 1,
    },
  },

  // 4. Multi-Agent Workflow
  {
    id: 'multi-agent',
    name: 'Multi-Agent Workflow',
    description: 'Workflow with multiple agents working in parallel',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        data: {
          label: 'Content Review',
          config: {
            triggerType: 'webhook',
            description: 'New content submitted for review',
          },
        },
        position: { x: 100, y: 100 },
      },
      {
        id: 'spawn-1',
        type: 'spawn-agent',
        data: {
          label: 'Parallel Analysis',
          config: {
            agentCount: 3,
            prompts: [
              'Review the content for grammar and spelling errors: {{content}}',
              'Check the content for factual accuracy: {{content}}',
              'Evaluate the content for tone and style: {{content}}',
            ],
            aggregationStrategy: 'combine',
          },
        },
        position: { x: 300, y: 100 },
      },
      {
        id: 'agent-1',
        type: 'agent',
        data: {
          label: 'Final Review',
          config: {
            prompt: 'Based on the parallel analysis results, provide a final review summary: {{analysisResults}}',
            model: 'llama-3.1-70b-versatile',
            temperature: 0.5,
          },
        },
        position: { x: 500, y: 100 },
      },
      {
        id: 'approval-1',
        type: 'human-approval',
        data: {
          label: 'Editor Approval',
          config: {
            message: 'Content review complete. Please approve or request changes.',
            approvers: ['editor@company.com'],
            timeout: 7200, // 2 hours
          },
        },
        position: { x: 700, y: 100 },
      },
      {
        id: 'action-1',
        type: 'action',
        data: {
          label: 'Publish Content',
          config: {
            actionType: 'http-request',
            httpUrl: 'https://api.company.com/content/publish',
            httpMethod: 'POST',
          },
        },
        position: { x: 900, y: 100 },
      },
    ],
    edges: [
      { id: 'edge-1', source: 'trigger-1', target: 'spawn-1' },
      { id: 'edge-2', source: 'spawn-1', target: 'agent-1' },
      { id: 'edge-3', source: 'agent-1', target: 'approval-1' },
      { id: 'edge-4', source: 'approval-1', target: 'action-1' },
    ],
    metadata: {
      createdAt: new Date().toISOString(),
      version: 1,
    },
  },

  // 5. Error Handling Workflow
  {
    id: 'error-handling',
    name: 'Error Handling Workflow',
    description: 'Workflow demonstrating error handling and recovery',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        data: {
          label: 'Process File',
          config: {
            triggerType: 'webhook',
            description: 'File uploaded for processing',
          },
        },
        position: { x: 100, y: 100 },
      },
      {
        id: 'action-1',
        type: 'action',
        data: {
          label: 'Validate File',
          config: {
            actionType: 'data-transform',
            transformScript: 'if ({{fileSize}} > 10000000) throw new Error("File too large"); JSON.stringify({ valid: true })',
          },
        },
        position: { x: 300, y: 100 },
      },
      {
        id: 'agent-1',
        type: 'agent',
        data: {
          label: 'Process Content',
          config: {
            prompt: 'Process the file content: {{fileContent}}',
            model: 'llama-3.1-70b-versatile',
            temperature: 0.3,
          },
        },
        position: { x: 500, y: 100 },
      },
      {
        id: 'action-2',
        type: 'action',
        data: {
          label: 'Save Results',
          config: {
            actionType: 'http-request',
            httpUrl: 'https://api.company.com/results/save',
            httpMethod: 'POST',
          },
        },
        position: { x: 700, y: 100 },
      },
      {
        id: 'action-3',
        type: 'action',
        data: {
          label: 'Send Error Notification',
          config: {
            actionType: 'notification',
            message: 'File processing failed: {{errorMessage}}',
          },
        },
        position: { x: 500, y: 200 },
      },
    ],
    edges: [
      { id: 'edge-1', source: 'trigger-1', target: 'action-1' },
      { id: 'edge-2', source: 'action-1', target: 'agent-1' },
      { id: 'edge-3', source: 'agent-1', target: 'action-2' },
      { id: 'edge-4', source: 'action-1', target: 'action-3', condition: '{{error}}' },
      { id: 'edge-5', source: 'agent-1', target: 'action-3', condition: '{{error}}' },
    ],
    metadata: {
      createdAt: new Date().toISOString(),
      version: 1,
    },
  },

  // 6. Complex Business Process Workflow
  {
    id: 'business-process',
    name: 'Complex Business Process',
    description: 'A comprehensive business process workflow with multiple decision points',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        data: {
          label: 'Customer Request',
          config: {
            triggerType: 'webhook',
            description: 'Customer submits a request',
          },
        },
        position: { x: 100, y: 100 },
      },
      {
        id: 'agent-1',
        type: 'agent',
        data: {
          label: 'Classify Request',
          config: {
            prompt: 'Classify this customer request: {{requestText}}. Categories: urgent, standard, low-priority',
            model: 'llama-3.1-70b-versatile',
            temperature: 0.2,
          },
        },
        position: { x: 300, y: 100 },
      },
      {
        id: 'condition-1',
        type: 'condition',
        data: {
          label: 'Check Priority',
          config: {
            condition: '{{priority}} === "urgent"',
            trueLabel: 'Urgent',
            falseLabel: 'Standard',
          },
        },
        position: { x: 500, y: 100 },
      },
      {
        id: 'approval-1',
        type: 'human-approval',
        data: {
          label: 'Manager Review',
          config: {
            message: 'Urgent request requires manager review',
            approvers: ['manager@company.com'],
            timeout: 1800, // 30 minutes
          },
        },
        position: { x: 700, y: 50 },
      },
      {
        id: 'action-1',
        type: 'action',
        data: {
          label: 'Assign to Team',
          config: {
            actionType: 'data-transform',
            transformScript: 'JSON.stringify({ assignedTo: "support-team", priority: {{priority}} })',
          },
        },
        position: { x: 700, y: 150 },
      },
      {
        id: 'agent-2',
        type: 'agent',
        data: {
          label: 'Generate Response',
          config: {
            prompt: 'Generate a professional response for this customer request: {{requestText}}',
            model: 'llama-3.1-70b-versatile',
            temperature: 0.7,
          },
        },
        position: { x: 900, y: 100 },
      },
      {
        id: 'approval-2',
        type: 'human-approval',
        data: {
          label: 'Review Response',
          config: {
            message: 'Please review the generated response before sending',
            approvers: ['supervisor@company.com'],
            timeout: 3600, // 1 hour
          },
        },
        position: { x: 1100, y: 100 },
      },
      {
        id: 'action-2',
        type: 'action',
        data: {
          label: 'Send Response',
          config: {
            actionType: 'http-request',
            httpUrl: 'https://api.company.com/messages/send',
            httpMethod: 'POST',
          },
        },
        position: { x: 1300, y: 100 },
      },
    ],
    edges: [
      { id: 'edge-1', source: 'trigger-1', target: 'agent-1' },
      { id: 'edge-2', source: 'agent-1', target: 'condition-1' },
      { id: 'edge-3', source: 'condition-1', target: 'approval-1', condition: '{{priority}} === "urgent"' },
      { id: 'edge-4', source: 'condition-1', target: 'action-1', condition: '{{priority}} !== "urgent"' },
      { id: 'edge-5', source: 'approval-1', target: 'action-1' },
      { id: 'edge-6', source: 'action-1', target: 'agent-2' },
      { id: 'edge-7', source: 'agent-2', target: 'approval-2' },
      { id: 'edge-8', source: 'approval-2', target: 'action-2' },
    ],
    metadata: {
      createdAt: new Date().toISOString(),
      version: 1,
    },
  },
];

/**
 * Get a specific example workflow by ID
 */
export function getExampleWorkflow(id: string): Workflow | undefined {
  return exampleWorkflows.find(workflow => workflow.id === id);
}

/**
 * Get all example workflows
 */
export function getAllExampleWorkflows(): Workflow[] {
  return exampleWorkflows;
}

/**
 * Get example workflows by pattern
 */
export function getExampleWorkflowsByPattern(pattern: 'linear' | 'conditional' | 'cyclic' | 'multi-agent' | 'error-handling' | 'business'): Workflow[] {
  return exampleWorkflows.filter(workflow => {
    switch (pattern) {
      case 'linear':
        return workflow.id === 'simple-linear';
      case 'conditional':
        return workflow.id === 'conditional-branching';
      case 'cyclic':
        return workflow.id === 'cyclic-loop';
      case 'multi-agent':
        return workflow.id === 'multi-agent';
      case 'error-handling':
        return workflow.id === 'error-handling';
      case 'business':
        return workflow.id === 'business-process';
      default:
        return false;
    }
  });
}