import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Play } from 'lucide-react';

export function TriggerNode({ data, selected }: NodeProps) {
  return (
    <div className={`px-4 py-2 shadow-md rounded-md bg-white border-2 min-w-[120px] ${
      selected ? 'border-blue-500' : 'border-gray-300'
    }`}>
      <div className="flex items-center space-x-2">
        <Play className="h-4 w-4 text-blue-600" />
        <div className="text-sm font-medium">{data.label}</div>
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {data.config?.triggerType || 'manual'}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3"
      />
    </div>
  );
}
