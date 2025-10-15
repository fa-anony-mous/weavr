import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Settings } from 'lucide-react';

export function ActionNode({ data, selected }: NodeProps) {
  return (
    <div className={`px-4 py-2 shadow-md rounded-md bg-white border-2 min-w-[120px] ${
      selected ? 'border-green-500' : 'border-gray-300'
    }`}>
      <div className="flex items-center space-x-2">
        <Settings className="h-4 w-4 text-green-600" />
        <div className="text-sm font-medium">{data.label}</div>
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {data.config?.actionType || 'custom'}
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
