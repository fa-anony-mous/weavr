// Node Types
export type NodeType = 
  | 'trigger'           // HTTP webhook, manual trigger
  | 'action'            // Deterministic operation
  | 'agent'             // LLM-powered reasoning
  | 'human-approval'    // Human-in-the-loop
  | 'condition'         // Branching logic
  | 'loop'              // Iteration/cyclic
  | 'spawn-agent';      // Dynamic agent creation

// Execution Status
export type ExecutionStatus = 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

// Node Status
export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

// Workflow Definition
export interface WorkflowNode {
  id: string;
  type: NodeType;
  data: {
    label: string;
    config: Record<string, any>; // Node-specific config
  };
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: string; // For conditional edges
  label?: string; // Optional edge label
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metadata: {
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
    version: number;
  };
}

// Execution State
export interface ExecutionContext {
  workflowId: string;
  executionId: string;
  status: ExecutionStatus;
  currentNodeId: string | null;
  stepResults: Record<string, any>;
  variables: Record<string, any>;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
  nodeStatuses: Record<string, NodeStatus>;
  nodeVisitCounts: Record<string, number>; // For cycle detection
  parentExecutionId?: string; // For spawned workflows
  childExecutionIds: string[]; // For parent workflows
}

// Node-specific configurations
export interface TriggerNodeConfig {
  triggerType: 'webhook' | 'manual' | 'schedule';
  webhookPath?: string;
  scheduleExpression?: string;
}

export interface ActionNodeConfig {
  actionType: 'http-request' | 'data-transform' | 'notification' | 'custom';
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  httpUrl?: string;
  httpHeaders?: Record<string, string>;
  transformScript?: string;
  notificationType?: 'email' | 'slack' | 'webhook';
  customScript?: string;
}

export interface AgentNodeConfig {
  promptTemplate: string;
  model: string;
  temperature: number;
  maxTokens?: number;
  systemPrompt?: string;
  tools?: string[]; // Future: tool calling support
}

export interface ApprovalNodeConfig {
  approvalMessage: string;
  approverEmail?: string;
  timeoutMinutes?: number;
  requireReason?: boolean;
}

export interface ConditionNodeConfig {
  expression: string; // JavaScript expression
  trueLabel?: string;
  falseLabel?: string;
}

export interface LoopNodeConfig {
  maxIterations: number;
  exitCondition?: string; // JavaScript expression
  loopVariable?: string; // Variable to track iterations
}

export interface SpawnAgentNodeConfig {
  agentPrompt: string;
  maxAgents: number;
  aggregationStrategy: 'first' | 'all' | 'majority' | 'custom';
  customAggregation?: string;
}

// API Request/Response Types
export interface CreateWorkflowRequest {
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface ExecuteWorkflowRequest {
  workflowId: string;
  triggerData: Record<string, any>;
  variables?: Record<string, any>;
}

export interface ExecuteWorkflowResponse {
  executionId: string;
  status: ExecutionStatus;
  message: string;
}

export interface ExecutionStatusResponse {
  execution: ExecutionContext;
  isComplete: boolean;
  nextPollIn?: number; // milliseconds
}

export interface ApprovalRequest {
  executionId: string;
  nodeId: string;
  message: string;
  data: Record<string, any>;
  timeoutAt?: string;
}

export interface ApprovalResponse {
  executionId: string;
  approved: boolean;
  reason?: string;
  data?: Record<string, any>;
}

// Copilot Types
export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface CopilotSession {
  id: string;
  messages: CopilotMessage[];
  currentStep: 'requirements' | 'generation' | 'refinement' | 'complete';
  requirements: {
    businessProcess?: string;
    triggers?: string[];
    decisions?: string[];
    approvals?: string[];
    integrations?: string[];
    constraints?: string[];
  };
  generatedWorkflow?: Workflow;
  createdAt: string;
  updatedAt: string;
}

// Error Types
export interface WorkflowError {
  code: string;
  message: string;
  nodeId?: string;
  executionId?: string;
  timestamp: string;
  details?: Record<string, any>;
}

// Utility Types
export type NodeConfig = 
  | TriggerNodeConfig
  | ActionNodeConfig
  | AgentNodeConfig
  | ApprovalNodeConfig
  | ConditionNodeConfig
  | LoopNodeConfig
  | SpawnAgentNodeConfig;

export interface WorkflowValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// React Flow specific types
export interface ReactFlowNode extends WorkflowNode {
  selected?: boolean;
  dragging?: boolean;
}

export interface ReactFlowEdge extends WorkflowEdge {
  selected?: boolean;
  animated?: boolean;
}
