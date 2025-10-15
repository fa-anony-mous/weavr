'use client';

import React, { useCallback, useState, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  NodeTypes,
  EdgeTypes,
  ReactFlowProvider,
  ReactFlowInstance,
  OnConnect,
  OnNodesChange,
  OnEdgesChange,
  NodeChange,
  EdgeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Workflow, WorkflowNode, WorkflowEdge } from '@/types/workflow';
import { TriggerNode } from './nodes/trigger-node';
import { ActionNode } from './nodes/action-node';
import { AgentNode } from './nodes/agent-node';
import { ApprovalNode } from './nodes/approval-node';
import { ConditionNode } from './nodes/condition-node';
import { LoopNode } from './nodes/loop-node';
import { SpawnNode } from './nodes/spawn-node';
import { NodePalette } from './node-palette';
import { NodePropertiesPanel } from './node-properties-panel';

// Define custom node types
const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  agent: AgentNode,
  'human-approval': ApprovalNode,
  condition: ConditionNode,
  loop: LoopNode,
  'spawn-agent': SpawnNode,
};

interface WorkflowBuilderProps {
  workflow: Workflow;
  onWorkflowChange: (workflow: Workflow) => void;
}

export function WorkflowBuilder({ workflow, onWorkflowChange }: WorkflowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow.edges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  // Update workflow when nodes or edges change (avoid infinite loop by not depending on `workflow`)
  React.useEffect(() => {
    const updatedWorkflow: Workflow = {
      ...workflow,
      nodes: nodes as WorkflowNode[],
      edges: edges as WorkflowEdge[],
      metadata: {
        ...workflow.metadata,
        updatedAt: new Date().toISOString(),
      },
    };
    onWorkflowChange(updatedWorkflow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  // Handle node changes
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);
  }, [onNodesChange]);

  // Handle edge changes
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes);
  }, [onEdgesChange]);

  // Handle new connections
  const onConnect: OnConnect = useCallback((params: Connection) => {
    const newEdge: Edge = {
      id: `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      source: params.source!,
      target: params.target!,
      type: 'smoothstep',
      animated: false,
    };
    setEdges((eds) => addEdge(newEdge, eds));
  }, [setEdges]);

  // Add new node
  const addNode = useCallback((nodeType: string) => {
    const newNode: Node = {
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: nodeType,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: {
        label: `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)} Node`,
        config: getDefaultConfig(nodeType),
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  // Delete selected node
  const deleteSelectedNode = useCallback(() => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((node) => node.id !== selectedNode.id));
      setEdges((eds) => eds.filter((edge) => 
        edge.source !== selectedNode.id && edge.target !== selectedNode.id
      ));
      setSelectedNode(null);
    }
  }, [selectedNode, setNodes, setEdges]);

  // Update node data
  const updateNodeData = useCallback((nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...newData } }
          : node
      )
    );
  }, [setNodes]);

  // Handle node selection
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  // Handle canvas click (deselect)
  const handleCanvasClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div className="h-full flex min-w-0">
      {/* Node Palette */}
      <div className="w-64 bg-white border-r border-gray-200 p-4">
        <NodePalette onAddNode={addNode} />
      </div>

      {/* Main Canvas */}
      <div className="flex-1 relative min-w-0 overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          onPaneClick={handleCanvasClick}
          onInit={setReactFlowInstance}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      {/* Properties Panel */}
      {selectedNode && (
        <div className="w-80 bg-white border-l border-gray-200 p-4">
          <NodePropertiesPanel
            node={selectedNode}
            onUpdateNode={updateNodeData}
            onDeleteNode={deleteSelectedNode}
          />
        </div>
      )}
    </div>
  );
}

// Get default configuration for node types
function getDefaultConfig(nodeType: string): Record<string, any> {
  const configs: Record<string, Record<string, any>> = {
    trigger: {
      triggerType: 'manual',
    },
    action: {
      actionType: 'custom',
      customScript: '// Add your custom logic here\nreturn { result: "success" };',
    },
    agent: {
      promptTemplate: 'Analyze the following data: {{input}}',
      model: 'llama-3.1-70b-versatile',
      temperature: 0.7,
    },
    'human-approval': {
      approvalMessage: 'Please review and approve this step',
      timeoutMinutes: 60,
    },
    condition: {
      expression: '{{value}} === true',
    },
    loop: {
      maxIterations: 10,
      loopVariable: 'iteration',
    },
    'spawn-agent': {
      agentPrompt: 'Process this data: {{input}}',
      maxAgents: 3,
      aggregationStrategy: 'all',
    },
  };

  return configs[nodeType] || {};
}
