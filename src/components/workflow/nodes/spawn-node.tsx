import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Users } from 'lucide-react';

export function SpawnNode({ data, selected }: NodeProps) {
  return (
    <div className={`px-4 py-2 shadow-md rounded-md bg-white border-2 min-w-[120px] ${
      selected ? 'border-pink-500' : 'border-gray-300'
    }`}>
      <div className="flex items-center space-x-2">
        <Users className="h-4 w-4 text-pink-600" />
        <div className="text-sm font-medium">{data.label}</div>
      </div>
      <div className="text-xs text-gray-500 mt-1">
        Spawn ({data.config?.maxAgents || 3} agents)
      </div>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3"
      />
    </div>
  );
}
