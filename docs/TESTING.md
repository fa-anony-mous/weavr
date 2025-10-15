# Testing Guide

## Overview

This guide covers testing strategies for the Agentic Orchestration Builder, including unit tests, integration tests, and end-to-end tests.

## Testing Stack

- **Jest** - Test runner and assertion library
- **React Testing Library** - Component testing
- **MSW** - API mocking
- **Playwright** - End-to-end testing
- **Supertest** - API testing

## Setup

### 1. Install Dependencies

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install --save-dev msw supertest
npm install --save-dev playwright @playwright/test
```

### 2. Jest Configuration

Create `jest.config.js`:

```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}

module.exports = createJestConfig(customJestConfig)
```

### 3. Jest Setup

Create `jest.setup.js`:

```javascript
import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    }
  },
}))

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock environment variables
process.env.GROQ_API_KEY = 'test-api-key'
process.env.UPSTASH_REDIS_REST_URL = 'https://test-redis.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
```

## Unit Tests

### 1. Workflow Executor Tests

```typescript
// src/lib/workflow-engine/__tests__/executor.test.ts
import { WorkflowExecutor } from '../executor'
import { Workflow, WorkflowNode } from '@/types/workflow'

describe('WorkflowExecutor', () => {
  let executor: WorkflowExecutor
  let mockWorkflow: Workflow

  beforeEach(() => {
    executor = new WorkflowExecutor()
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
      ],
      edges: [],
      metadata: {
        createdAt: new Date().toISOString(),
        version: 1,
      },
    }
  })

  describe('validateWorkflow', () => {
    it('should validate a correct workflow', () => {
      const result = executor.validateWorkflow(mockWorkflow)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing trigger node', () => {
      const workflowWithoutTrigger = {
        ...mockWorkflow,
        nodes: [],
      }

      const result = executor.validateWorkflow(workflowWithoutTrigger)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('No trigger node found')
    })
  })

  describe('executeWorkflow', () => {
    it('should execute a simple workflow', async () => {
      const result = await executor.executeWorkflow(mockWorkflow, { test: 'data' })
      
      expect(result.success).toBe(true)
      expect(result.executionId).toBeDefined()
      expect(result.status).toBe('completed')
    })
  })
})
```

### 2. Node Executor Tests

```typescript
// src/lib/nodes/__tests__/agent-executor.test.ts
import { AgentExecutor } from '../agent-executor'
import { ExecutionContext } from '@/types/workflow'

// Mock Groq client
jest.mock('@/lib/groq-client', () => ({
  groqClient: {
    callAgent: jest.fn(),
  },
}))

describe('AgentExecutor', () => {
  let executor: AgentExecutor
  let mockContext: ExecutionContext

  beforeEach(() => {
    executor = new AgentExecutor()
    mockContext = {
      workflowId: 'test-workflow',
      executionId: 'test-execution',
      status: 'running',
      currentNodeId: 'agent-1',
      stepResults: {},
      variables: { input: 'test data' },
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  })

  it('should execute agent node successfully', async () => {
    const { groqClient } = require('@/lib/groq-client')
    groqClient.callAgent.mockResolvedValue({
      content: 'AI response',
      model: 'llama-3.1-70b-versatile',
      finishReason: 'stop',
    })

    const result = await executor.execute(
      {
        id: 'agent-1',
        type: 'agent',
        data: {
          label: 'AI Analysis',
          config: {
            prompt: 'Analyze: {{input}}',
            model: 'llama-3.1-70b-versatile',
          },
        },
        position: { x: 0, y: 0 },
      },
      mockContext
    )

    expect(result.success).toBe(true)
    expect(result.data.response).toBe('AI response')
    expect(groqClient.callAgent).toHaveBeenCalledWith(
      'Analyze: test data',
      mockContext.variables,
      expect.any(Object)
    )
  })
})
```

### 3. API Route Tests

```typescript
// src/app/api/__tests__/workflows.test.ts
import { createMocks } from 'node-mocks-http'
import { POST, GET } from '../workflows/route'

describe('/api/workflows', () => {
  describe('POST', () => {
    it('should create a new workflow', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          name: 'Test Workflow',
          description: 'A test workflow',
          nodes: [],
          edges: [],
        },
      })

      await POST(req as any, res as any)

      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('Test Workflow')
    })

    it('should validate request body', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          // Missing required fields
        },
      })

      await POST(req as any, res as any)

      expect(res._getStatusCode()).toBe(400)
      const data = JSON.parse(res._getData())
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid request body')
    })
  })

  describe('GET', () => {
    it('should return workflows list', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        query: { limit: '10', offset: '0' },
      })

      await GET(req as any, res as any)

      expect(res._getStatusCode()).toBe(200)
      const data = JSON.parse(res._getData())
      expect(data.success).toBe(true)
      expect(Array.isArray(data.data.workflows)).toBe(true)
    })
  })
})
```

## Integration Tests

### 1. Workflow Execution Integration

```typescript
// src/lib/__tests__/workflow-integration.test.ts
import { WorkflowExecutor } from '../workflow-engine/executor'
import { redisClient } from '../redis'
import { groqClient } from '../groq-client'

// Mock external dependencies
jest.mock('../redis')
jest.mock('../groq-client')

describe('Workflow Integration', () => {
  let executor: WorkflowExecutor

  beforeEach(() => {
    executor = new WorkflowExecutor()
    jest.clearAllMocks()
  })

  it('should execute a complete workflow with all node types', async () => {
    const workflow = {
      id: 'integration-test',
      name: 'Integration Test Workflow',
      description: 'Test workflow with all node types',
      nodes: [
        {
          id: 'trigger-1',
          type: 'trigger',
          data: { label: 'Start', config: { triggerType: 'manual' } },
          position: { x: 0, y: 0 },
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
          position: { x: 100, y: 0 },
        },
        {
          id: 'agent-1',
          type: 'agent',
          data: {
            label: 'AI Analysis',
            config: {
              prompt: 'Analyze: {{processedData}}',
              model: 'llama-3.1-70b-versatile',
            },
          },
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
    }

    // Mock Redis responses
    redisClient.saveExecution.mockResolvedValue(true)
    redisClient.getExecution.mockResolvedValue(null)

    // Mock Groq response
    groqClient.callAgent.mockResolvedValue({
      content: 'AI analysis complete',
      model: 'llama-3.1-70b-versatile',
      finishReason: 'stop',
    })

    const result = await executor.executeWorkflow(workflow, { input: 'test data' })

    expect(result.success).toBe(true)
    expect(result.status).toBe('completed')
    expect(redisClient.saveExecution).toHaveBeenCalled()
    expect(groqClient.callAgent).toHaveBeenCalled()
  })
})
```

### 2. API Integration Tests

```typescript
// src/app/api/__tests__/execute-integration.test.ts
import { createMocks } from 'node-mocks-http'
import { POST } from '../execute/route'
import { redisClient } from '@/lib/redis'
import { WorkflowExecutor } from '@/lib/workflow-engine/executor'

jest.mock('@/lib/redis')
jest.mock('@/lib/workflow-engine/executor')

describe('Execute API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should execute workflow end-to-end', async () => {
    const mockWorkflow = {
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
      ],
      edges: [],
      metadata: {
        createdAt: new Date().toISOString(),
        version: 1,
      },
    }

    const mockExecution = {
      executionId: 'test-execution',
      workflowId: 'test-workflow',
      status: 'completed',
      stepResults: {},
      variables: {},
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Mock Redis responses
    redisClient.getWorkflow.mockResolvedValue(mockWorkflow)
    redisClient.saveExecution.mockResolvedValue(true)

    // Mock WorkflowExecutor
    const mockExecutor = {
      executeWorkflow: jest.fn().mockResolvedValue({
        success: true,
        executionId: 'test-execution',
        status: 'completed',
      }),
    }
    ;(WorkflowExecutor as jest.Mock).mockImplementation(() => mockExecutor)

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        workflowId: 'test-workflow',
        triggerData: { input: 'test' },
      },
    })

    await POST(req as any, res as any)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.success).toBe(true)
    expect(data.data.executionId).toBe('test-execution')
  })
})
```

## Component Tests

### 1. Workflow Builder Component

```typescript
// src/components/workflow/__tests__/workflow-builder.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorkflowBuilder } from '../workflow-builder'

// Mock React Flow
jest.mock('reactflow', () => ({
  ReactFlow: ({ children, onInit }: any) => (
    <div data-testid="react-flow" onLoad={onInit}>
      {children}
    </div>
  ),
  ReactFlowProvider: ({ children }: any) => <div>{children}</div>,
  useNodesState: () => [[], jest.fn()],
  useEdgesState: () => [[], jest.fn()],
  addEdge: jest.fn(),
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
}))

describe('WorkflowBuilder', () => {
  it('should render workflow builder', () => {
    render(<WorkflowBuilder />)
    
    expect(screen.getByTestId('react-flow')).toBeInTheDocument()
    expect(screen.getByTestId('background')).toBeInTheDocument()
    expect(screen.getByTestId('controls')).toBeInTheDocument()
  })

  it('should add nodes when node type is selected', async () => {
    const user = userEvent.setup()
    render(<WorkflowBuilder />)
    
    const addNodeButton = screen.getByText('Add Trigger')
    await user.click(addNodeButton)
    
    // Verify node was added
    expect(screen.getByText('New Trigger')).toBeInTheDocument()
  })

  it('should save workflow', async () => {
    const user = userEvent.setup()
    render(<WorkflowBuilder />)
    
    const saveButton = screen.getByText('Save Workflow')
    await user.click(saveButton)
    
    // Verify save functionality
    await waitFor(() => {
      expect(screen.getByText('Workflow saved successfully')).toBeInTheDocument()
    })
  })
})
```

### 2. Node Properties Panel

```typescript
// src/components/workflow/__tests__/node-properties-panel.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NodePropertiesPanel } from '../node-properties-panel'

const mockNode = {
  id: 'test-node',
  type: 'agent',
  data: {
    label: 'Test Agent',
    config: {
      prompt: 'Test prompt',
      model: 'llama-3.1-70b-versatile',
    },
  },
  position: { x: 0, y: 0 },
}

describe('NodePropertiesPanel', () => {
  it('should render node properties', () => {
    render(<NodePropertiesPanel node={mockNode} onUpdate={jest.fn()} onClose={jest.fn()} />)
    
    expect(screen.getByDisplayValue('Test Agent')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Test prompt')).toBeInTheDocument()
    expect(screen.getByDisplayValue('llama-3.1-70b-versatile')).toBeInTheDocument()
  })

  it('should update node properties', async () => {
    const user = userEvent.setup()
    const onUpdate = jest.fn()
    
    render(<NodePropertiesPanel node={mockNode} onUpdate={onUpdate} onClose={jest.fn()} />)
    
    const labelInput = screen.getByDisplayValue('Test Agent')
    await user.clear(labelInput)
    await user.type(labelInput, 'Updated Agent')
    
    const saveButton = screen.getByText('Save Changes')
    await user.click(saveButton)
    
    expect(onUpdate).toHaveBeenCalledWith({
      ...mockNode,
      data: {
        ...mockNode.data,
        label: 'Updated Agent',
      },
    })
  })
})
```

## End-to-End Tests

### 1. Playwright Setup

Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

### 2. E2E Test Examples

```typescript
// e2e/workflow-builder.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Workflow Builder', () => {
  test('should create and execute a workflow', async ({ page }) => {
    await page.goto('/builder')
    
    // Add trigger node
    await page.click('[data-testid="add-trigger"]')
    await expect(page.locator('[data-testid="node-trigger-1"]')).toBeVisible()
    
    // Add action node
    await page.click('[data-testid="add-action"]')
    await expect(page.locator('[data-testid="node-action-1"]')).toBeVisible()
    
    // Connect nodes
    await page.dragAndDrop(
      '[data-testid="node-trigger-1"]',
      '[data-testid="node-action-1"]'
    )
    
    // Configure action node
    await page.click('[data-testid="node-action-1"]')
    await page.fill('[data-testid="action-label"]', 'Process Data')
    await page.selectOption('[data-testid="action-type"]', 'data-transform')
    await page.fill('[data-testid="transform-script"]', 'JSON.stringify({ processed: true })')
    
    // Save workflow
    await page.click('[data-testid="save-workflow"]')
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible()
    
    // Execute workflow
    await page.click('[data-testid="execute-workflow"]')
    await expect(page.locator('[data-testid="execution-status"]')).toContainText('completed')
  })
})

test.describe('AI Copilot', () => {
  test('should generate workflow from natural language', async ({ page }) => {
    await page.goto('/copilot')
    
    // Start conversation
    await page.fill('[data-testid="chat-input"]', 'I need a workflow to process customer orders')
    await page.click('[data-testid="send-message"]')
    
    // Wait for AI response
    await expect(page.locator('[data-testid="ai-response"]')).toBeVisible()
    
    // Continue conversation
    await page.fill('[data-testid="chat-input"]', 'Add a human approval step for orders over $1000')
    await page.click('[data-testid="send-message"]')
    
    // Generate workflow
    await page.click('[data-testid="generate-workflow"]')
    await expect(page.locator('[data-testid="generated-workflow"]')).toBeVisible()
    
    // Export to builder
    await page.click('[data-testid="export-to-builder"]')
    await expect(page).toHaveURL('/builder')
  })
})
```

## Test Utilities

### 1. Mock Data Factory

```typescript
// src/lib/__tests__/test-utils.ts
import { Workflow, WorkflowNode, WorkflowEdge } from '@/types/workflow'

export function createMockWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
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
    ],
    edges: [],
    metadata: {
      createdAt: new Date().toISOString(),
      version: 1,
    },
    ...overrides,
  }
}

export function createMockNode(overrides: Partial<WorkflowNode> = {}): WorkflowNode {
  return {
    id: 'test-node',
    type: 'action',
    data: { label: 'Test Node', config: {} },
    position: { x: 0, y: 0 },
    ...overrides,
  }
}

export function createMockEdge(overrides: Partial<WorkflowEdge> = {}): WorkflowEdge {
  return {
    id: 'test-edge',
    source: 'node-1',
    target: 'node-2',
    ...overrides,
  }
}
```

### 2. API Test Helpers

```typescript
// src/lib/__tests__/api-helpers.ts
import { createMocks } from 'node-mocks-http'

export function createMockRequest(method: string, body?: any, query?: any) {
  return createMocks({
    method,
    body,
    query,
  })
}

export function expectSuccessResponse(res: any, expectedData?: any) {
  expect(res._getStatusCode()).toBe(200)
  const data = JSON.parse(res._getData())
  expect(data.success).toBe(true)
  if (expectedData) {
    expect(data.data).toMatchObject(expectedData)
  }
  return data
}

export function expectErrorResponse(res: any, expectedStatus: number, expectedError?: string) {
  expect(res._getStatusCode()).toBe(expectedStatus)
  const data = JSON.parse(res._getData())
  expect(data.success).toBe(false)
  if (expectedError) {
    expect(data.error).toContain(expectedError)
  }
  return data
}
```

## Running Tests

### 1. Unit Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test workflow-executor.test.ts
```

### 2. Integration Tests

```bash
# Run integration tests
npm run test:integration

# Run with verbose output
npm run test:integration -- --verbose
```

### 3. E2E Tests

```bash
# Run E2E tests
npm run test:e2e

# Run E2E tests in headed mode
npm run test:e2e -- --headed

# Run specific E2E test
npm run test:e2e -- workflow-builder.spec.ts
```

## Test Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:integration": "jest --testPathPattern=integration",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:all": "npm run test && npm run test:integration && npm run test:e2e"
  }
}
```

## Best Practices

### 1. Test Organization

- Group related tests in `describe` blocks
- Use descriptive test names
- Keep tests focused and atomic
- Mock external dependencies

### 2. Test Data

- Use factories for creating test data
- Keep test data minimal and focused
- Use realistic but simple data
- Avoid hardcoded values

### 3. Assertions

- Use specific assertions
- Test both success and error cases
- Verify side effects
- Check error messages

### 4. Performance

- Keep tests fast
- Use parallel execution
- Mock expensive operations
- Clean up after tests

### 5. Maintenance

- Update tests when code changes
- Remove obsolete tests
- Keep tests readable
- Document complex test scenarios
