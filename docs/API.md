# Agentic Orchestration Builder - API Documentation

## Overview

The Agentic Orchestration Builder provides a comprehensive REST API for managing workflows, executing them, and handling human-in-the-loop approvals. The API is built on Next.js API routes and follows RESTful conventions.

## Base URL

```
https://your-domain.vercel.app/api
```

## Authentication

Currently, the API does not require authentication for the demo version. In production, you would implement JWT or API key authentication.

## Error Handling

All API endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details (optional)"
}
```

## Workflow Management

### Create Workflow

**POST** `/api/workflows`

Create a new workflow definition.

**Request Body:**
```json
{
  "name": "My Workflow",
  "description": "A sample workflow",
  "nodes": [
    {
      "id": "trigger-1",
      "type": "trigger",
      "data": {
        "label": "Start",
        "config": {
          "triggerType": "manual"
        }
      },
      "position": { "x": 100, "y": 100 }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "trigger-1",
      "target": "action-1"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "workflow-123",
    "name": "My Workflow",
    "description": "A sample workflow",
    "nodes": [...],
    "edges": [...],
    "metadata": {
      "createdAt": "2024-01-01T00:00:00.000Z",
      "version": 1
    }
  }
}
```

### Get Workflow

**GET** `/api/workflows/{id}`

Retrieve a specific workflow by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "workflow-123",
    "name": "My Workflow",
    "description": "A sample workflow",
    "nodes": [...],
    "edges": [...],
    "metadata": {
      "createdAt": "2024-01-01T00:00:00.000Z",
      "version": 1
    }
  }
}
```

### Update Workflow

**PUT** `/api/workflows/{id}`

Update an existing workflow.

**Request Body:** Same as create workflow

**Response:** Same as get workflow

### Delete Workflow

**DELETE** `/api/workflows/{id}`

Delete a workflow.

**Response:**
```json
{
  "success": true,
  "message": "Workflow deleted successfully"
}
```

### List Workflows

**GET** `/api/workflows`

Get all workflows.

**Query Parameters:**
- `limit` (optional): Number of workflows to return (default: 50)
- `offset` (optional): Number of workflows to skip (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "workflows": [...],
    "total": 10,
    "limit": 50,
    "offset": 0
  }
}
```

## Workflow Execution

### Start Execution

**POST** `/api/execute`

Start executing a workflow.

**Request Body:**
```json
{
  "workflowId": "workflow-123",
  "triggerData": {
    "input": "sample data"
  },
  "variables": {
    "customVar": "value"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "exec-123",
    "status": "running",
    "workflowId": "workflow-123",
    "startedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Get Execution Status

**GET** `/api/execute/{executionId}`

Get the current status of a workflow execution.

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "exec-123",
    "workflowId": "workflow-123",
    "status": "running",
    "currentNodeId": "action-1",
    "stepResults": {
      "trigger-1": {
        "success": true,
        "data": { "triggered": true }
      }
    },
    "variables": {
      "input": "sample data"
    },
    "startedAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:01:00.000Z"
  }
}
```

### Resume Execution

**POST** `/api/execute/{executionId}/resume`

Resume a paused execution.

**Request Body:**
```json
{
  "resumeData": {
    "approved": true,
    "reason": "Approved by manager"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "exec-123",
    "status": "running",
    "message": "Execution resumed successfully"
  }
}
```

### Cancel Execution

**DELETE** `/api/execute/{executionId}`

Cancel a running execution.

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "exec-123",
    "status": "cancelled",
    "message": "Execution cancelled successfully"
  }
}
```

## Human-in-the-Loop Approvals

### Approve Execution

**POST** `/api/approvals/{executionId}/approve`

Approve a pending human approval.

**Request Body:**
```json
{
  "approvedBy": "manager@company.com",
  "reason": "Approved after review",
  "data": {
    "additionalInfo": "Looks good to proceed"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "exec-123",
    "status": "approved",
    "approvedBy": "manager@company.com",
    "approvedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Reject Execution

**POST** `/api/approvals/{executionId}/reject`

Reject a pending human approval.

**Request Body:**
```json
{
  "rejectedBy": "manager@company.com",
  "reason": "Needs more information"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "exec-123",
    "status": "rejected",
    "rejectedBy": "manager@company.com",
    "rejectedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## AI Copilot

### Chat with Copilot

**POST** `/api/copilot/chat`

Chat with the AI copilot to generate workflows.

**Request Body:**
```json
{
  "sessionId": "session-123",
  "message": "I need a workflow to process customer orders",
  "context": {
    "businessType": "e-commerce"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session-123",
    "message": "I'll help you create a workflow for processing customer orders. Let me ask a few questions to understand your requirements better...",
    "nextStep": "requirements",
    "workflow": null
  }
}
```

### Get Copilot Session

**GET** `/api/copilot/session/{sessionId}`

Get the current state of a copilot session.

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session-123",
    "currentStep": "requirements",
    "messages": [
      {
        "role": "user",
        "content": "I need a workflow to process customer orders",
        "timestamp": "2024-01-01T00:00:00.000Z"
      },
      {
        "role": "assistant",
        "content": "I'll help you create a workflow...",
        "timestamp": "2024-01-01T00:01:00.000Z"
      }
    ],
    "workflow": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:01:00.000Z"
  }
}
```

## Node Types

### Trigger Node
```json
{
  "type": "trigger",
  "data": {
    "label": "Start",
    "config": {
      "triggerType": "manual" | "webhook" | "schedule",
      "description": "Description of the trigger"
    }
  }
}
```

### Action Node
```json
{
  "type": "action",
  "data": {
    "label": "Process Data",
    "config": {
      "actionType": "data-transform" | "http-request" | "notification" | "custom",
      "transformScript": "JavaScript code for data transformation",
      "httpUrl": "https://api.example.com/endpoint",
      "httpMethod": "GET" | "POST" | "PUT" | "DELETE",
      "httpHeaders": { "Authorization": "Bearer token" }
    }
  }
}
```

### Agent Node
```json
{
  "type": "agent",
  "data": {
    "label": "AI Analysis",
    "config": {
      "prompt": "Analyze the following data: {{input}}",
      "model": "llama-3.1-70b-versatile",
      "temperature": 0.7,
      "maxTokens": 1000
    }
  }
}
```

### Human Approval Node
```json
{
  "type": "human-approval",
  "data": {
    "label": "Manager Approval",
    "config": {
      "message": "Please approve this request",
      "approvers": ["manager@company.com"],
      "timeout": 3600
    }
  }
}
```

### Condition Node
```json
{
  "type": "condition",
  "data": {
    "label": "Check Condition",
    "config": {
      "condition": "{{amount}} > 1000",
      "trueLabel": "High Value",
      "falseLabel": "Standard"
    }
  }
}
```

### Loop Node
```json
{
  "type": "loop",
  "data": {
    "label": "Process Items",
    "config": {
      "maxIterations": 10,
      "loopVariable": "iteration",
      "exitCondition": "{{processedCount}} >= {{totalItems}}"
    }
  }
}
```

### Spawn Agent Node
```json
{
  "type": "spawn-agent",
  "data": {
    "label": "Parallel Analysis",
    "config": {
      "agentCount": 3,
      "prompts": [
        "Analyze for grammar: {{content}}",
        "Check facts: {{content}}",
        "Evaluate tone: {{content}}"
      ],
      "aggregationStrategy": "combine"
    }
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `WORKFLOW_NOT_FOUND` | Workflow with specified ID not found |
| `EXECUTION_NOT_FOUND` | Execution with specified ID not found |
| `INVALID_NODE_TYPE` | Invalid node type specified |
| `EXECUTION_FAILED` | Workflow execution failed |
| `APPROVAL_REQUIRED` | Human approval required |
| `TIMEOUT_ERROR` | Operation timed out |
| `RATE_LIMIT_ERROR` | Rate limit exceeded |
| `INTERNAL_ERROR` | Internal server error |

## Rate Limits

- **Workflow Creation**: 100 requests per hour
- **Workflow Execution**: 50 requests per hour
- **Copilot Chat**: 200 requests per hour
- **General API**: 1000 requests per hour

## Webhooks

### Execution Events

You can configure webhooks to receive notifications about workflow execution events:

- `execution.started` - Execution started
- `execution.completed` - Execution completed successfully
- `execution.failed` - Execution failed
- `execution.paused` - Execution paused for approval
- `execution.resumed` - Execution resumed after approval
- `execution.cancelled` - Execution cancelled

**Webhook Payload:**
```json
{
  "event": "execution.completed",
  "executionId": "exec-123",
  "workflowId": "workflow-123",
  "status": "completed",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "data": {
    "stepResults": {...},
    "variables": {...}
  }
}
```

## SDKs and Libraries

### JavaScript/TypeScript
```bash
npm install @agentic-orchestration/sdk
```

```typescript
import { AgenticOrchestrationClient } from '@agentic-orchestration/sdk';

const client = new AgenticOrchestrationClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://your-domain.vercel.app/api'
});

// Create a workflow
const workflow = await client.workflows.create({
  name: 'My Workflow',
  description: 'A sample workflow',
  nodes: [...],
  edges: [...]
});

// Execute a workflow
const execution = await client.executions.start({
  workflowId: workflow.id,
  triggerData: { input: 'test' }
});
```

### Python
```bash
pip install agentic-orchestration
```

```python
from agentic_orchestration import Client

client = Client(
    api_key='your-api-key',
    base_url='https://your-domain.vercel.app/api'
)

# Create a workflow
workflow = client.workflows.create(
    name='My Workflow',
    description='A sample workflow',
    nodes=[...],
    edges=[...]
)

# Execute a workflow
execution = client.executions.start(
    workflow_id=workflow.id,
    trigger_data={'input': 'test'}
)
```

## Examples

### Complete Workflow Example

```typescript
// 1. Create a workflow
const workflow = await fetch('/api/workflows', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Customer Onboarding',
    description: 'Automated customer onboarding process',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        data: {
          label: 'New Customer',
          config: { triggerType: 'webhook' }
        },
        position: { x: 100, y: 100 }
      },
      {
        id: 'agent-1',
        type: 'agent',
        data: {
          label: 'Validate Customer',
          config: {
            prompt: 'Validate customer data: {{customerData}}',
            model: 'llama-3.1-70b-versatile'
          }
        },
        position: { x: 300, y: 100 }
      },
      {
        id: 'approval-1',
        type: 'human-approval',
        data: {
          label: 'Manager Review',
          config: {
            message: 'Review new customer application',
            approvers: ['manager@company.com']
          }
        },
        position: { x: 500, y: 100 }
      },
      {
        id: 'action-1',
        type: 'action',
        data: {
          label: 'Create Account',
          config: {
            actionType: 'http-request',
            httpUrl: 'https://api.company.com/accounts',
            httpMethod: 'POST'
          }
        },
        position: { x: 700, y: 100 }
      }
    ],
    edges: [
      { id: 'edge-1', source: 'trigger-1', target: 'agent-1' },
      { id: 'edge-2', source: 'agent-1', target: 'approval-1' },
      { id: 'edge-3', source: 'approval-1', target: 'action-1' }
    ]
  })
});

// 2. Execute the workflow
const execution = await fetch('/api/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workflowId: workflow.id,
    triggerData: {
      customerData: {
        name: 'John Doe',
        email: 'john@example.com',
        company: 'Acme Corp'
      }
    }
  })
});

// 3. Monitor execution
const status = await fetch(`/api/execute/${execution.executionId}`);
console.log('Execution status:', status);
```

## Support

For API support and questions:
- Email: support@agentic-orchestration.com
- Documentation: https://docs.agentic-orchestration.com
- GitHub: https://github.com/agentic-orchestration/builder
