'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Play, 
  Settings, 
  Bot, 
  UserCheck, 
  GitBranch, 
  RotateCcw, 
  Users,
  Zap
} from 'lucide-react';

interface NodePaletteProps {
  onAddNode: (nodeType: string) => void;
}

const nodeTypes = [
  {
    type: 'trigger',
    label: 'Trigger',
    description: 'Start the workflow',
    icon: Play,
    color: 'bg-blue-500',
  },
  {
    type: 'action',
    label: 'Action',
    description: 'Perform an operation',
    icon: Settings,
    color: 'bg-green-500',
  },
  {
    type: 'agent',
    label: 'AI Agent',
    description: 'AI-powered reasoning',
    icon: Bot,
    color: 'bg-purple-500',
  },
  {
    type: 'human-approval',
    label: 'Approval',
    description: 'Human review step',
    icon: UserCheck,
    color: 'bg-orange-500',
  },
  {
    type: 'condition',
    label: 'Condition',
    description: 'Branch based on logic',
    icon: GitBranch,
    color: 'bg-yellow-500',
  },
  {
    type: 'loop',
    label: 'Loop',
    description: 'Repeat operations',
    icon: RotateCcw,
    color: 'bg-indigo-500',
  },
  {
    type: 'spawn-agent',
    label: 'Spawn Agents',
    description: 'Create multiple agents',
    icon: Users,
    color: 'bg-pink-500',
  },
];

export function NodePalette({ onAddNode }: NodePaletteProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Zap className="h-5 w-5 mr-2" />
            Node Palette
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Drag nodes onto the canvas to build your workflow
          </p>
          
          <div className="space-y-2">
            {nodeTypes.map((nodeType) => {
              const Icon = nodeType.icon;
              return (
                <Button
                  key={nodeType.type}
                  variant="outline"
                  className="w-full justify-start h-auto p-3"
                  onClick={() => onAddNode(nodeType.type)}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-md ${nodeType.color} text-white`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{nodeType.label}</div>
                      <div className="text-xs text-gray-500">
                        {nodeType.description}
                      </div>
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>• Start with a Trigger node</li>
            <li>• Connect nodes with edges</li>
            <li>• Click nodes to configure</li>
            <li>• Use Conditions for branching</li>
            <li>• Add Approvals for human oversight</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
