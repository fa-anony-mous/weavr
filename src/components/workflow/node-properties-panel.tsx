'use client';

import React, { useState } from 'react';
import { Node } from 'reactflow';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Save } from 'lucide-react';

interface NodePropertiesPanelProps {
  node: Node;
  onUpdateNode: (nodeId: string, data: any) => void;
  onDeleteNode: () => void;
}

export function NodePropertiesPanel({ node, onUpdateNode, onDeleteNode }: NodePropertiesPanelProps) {
  const [label, setLabel] = useState(node.data.label || '');
  const [config, setConfig] = useState(node.data.config || {});

  const handleSave = () => {
    onUpdateNode(node.id, {
      label,
      config,
    });
  };

  const updateConfig = (key: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [key]: value }));
  };

  const renderConfigFields = () => {
    if (!node.type) return <div>No configuration available for this node type.</div>;
    
    switch (node.type) {
      case 'trigger':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="triggerType">Trigger Type</Label>
              <Select
                value={config.triggerType || 'manual'}
                onValueChange={(value) => updateConfig('triggerType', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="schedule">Schedule</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {config.triggerType === 'webhook' && (
              <div>
                <Label htmlFor="webhookPath">Webhook Path</Label>
                <Input
                  id="webhookPath"
                  value={config.webhookPath || ''}
                  onChange={(e) => updateConfig('webhookPath', e.target.value)}
                  placeholder="/webhook/endpoint"
                />
              </div>
            )}
          </div>
        );

      case 'action':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="actionType">Action Type</Label>
              <Select
                value={config.actionType || 'custom'}
                onValueChange={(value) => updateConfig('actionType', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom Script</SelectItem>
                  <SelectItem value="http-request">HTTP Request</SelectItem>
                  <SelectItem value="data-transform">Data Transform</SelectItem>
                  <SelectItem value="notification">Notification</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {config.actionType === 'custom' && (
              <div>
                <Label htmlFor="customScript">Custom Script</Label>
                <Textarea
                  id="customScript"
                  value={config.customScript || ''}
                  onChange={(e) => updateConfig('customScript', e.target.value)}
                  placeholder="// Add your custom logic here"
                  rows={6}
                />
              </div>
            )}
            {config.actionType === 'http-request' && (
              <>
                <div>
                  <Label htmlFor="httpUrl">URL</Label>
                  <Input
                    id="httpUrl"
                    value={config.httpUrl || ''}
                    onChange={(e) => updateConfig('httpUrl', e.target.value)}
                    placeholder="https://api.example.com/endpoint"
                  />
                </div>
                <div>
                  <Label htmlFor="httpMethod">Method</Label>
                  <Select
                    value={config.httpMethod || 'GET'}
                    onValueChange={(value) => updateConfig('httpMethod', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        );

      case 'agent':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="promptTemplate">Prompt Template</Label>
              <Textarea
                id="promptTemplate"
                value={config.promptTemplate || ''}
                onChange={(e) => updateConfig('promptTemplate', e.target.value)}
                placeholder="Analyze the following data: {{input}}"
                rows={4}
              />
            </div>
            <div>
              <Label htmlFor="model">Model</Label>
              <Select
                value={config.model || 'llama-3.1-70b-versatile'}
                onValueChange={(value) => updateConfig('model', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="llama-3.1-70b-versatile">Llama 3.1 70B</SelectItem>
                  <SelectItem value="llama-3.1-8b-instant">Llama 3.1 8B</SelectItem>
                  <SelectItem value="mixtral-8x7b-32768">Mixtral 8x7B</SelectItem>
                  <SelectItem value="gemma-7b-it">Gemma 7B</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="temperature">Temperature</Label>
              <Input
                id="temperature"
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={config.temperature || 0.7}
                onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
              />
            </div>
          </div>
        );

      case 'human-approval':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="approvalMessage">Approval Message</Label>
              <Textarea
                id="approvalMessage"
                value={config.approvalMessage || ''}
                onChange={(e) => updateConfig('approvalMessage', e.target.value)}
                placeholder="Please review and approve this step"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="timeoutMinutes">Timeout (minutes)</Label>
              <Input
                id="timeoutMinutes"
                type="number"
                min="1"
                max="10080"
                value={config.timeoutMinutes || 60}
                onChange={(e) => updateConfig('timeoutMinutes', parseInt(e.target.value))}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="requireReason"
                checked={config.requireReason || false}
                onChange={(e) => updateConfig('requireReason', e.target.checked)}
              />
              <Label htmlFor="requireReason">Require reason for approval</Label>
            </div>
          </div>
        );

      case 'condition':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="expression">Expression</Label>
              <Input
                id="expression"
                value={config.expression || ''}
                onChange={(e) => updateConfig('expression', e.target.value)}
                placeholder="{{value}} === true"
              />
            </div>
            <div>
              <Label htmlFor="trueLabel">True Label</Label>
              <Input
                id="trueLabel"
                value={config.trueLabel || 'Yes'}
                onChange={(e) => updateConfig('trueLabel', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="falseLabel">False Label</Label>
              <Input
                id="falseLabel"
                value={config.falseLabel || 'No'}
                onChange={(e) => updateConfig('falseLabel', e.target.value)}
              />
            </div>
          </div>
        );

      case 'loop':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="maxIterations">Max Iterations</Label>
              <Input
                id="maxIterations"
                type="number"
                min="1"
                max="1000"
                value={config.maxIterations || 10}
                onChange={(e) => updateConfig('maxIterations', parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="exitCondition">Exit Condition</Label>
              <Input
                id="exitCondition"
                value={config.exitCondition || ''}
                onChange={(e) => updateConfig('exitCondition', e.target.value)}
                placeholder="{{iteration}} >= 5"
              />
            </div>
            <div>
              <Label htmlFor="loopVariable">Loop Variable</Label>
              <Input
                id="loopVariable"
                value={config.loopVariable || 'iteration'}
                onChange={(e) => updateConfig('loopVariable', e.target.value)}
              />
            </div>
          </div>
        );

      case 'spawn-agent':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="agentPrompt">Agent Prompt</Label>
              <Textarea
                id="agentPrompt"
                value={config.agentPrompt || ''}
                onChange={(e) => updateConfig('agentPrompt', e.target.value)}
                placeholder="Process this data: {{input}}"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="maxAgents">Max Agents</Label>
              <Input
                id="maxAgents"
                type="number"
                min="1"
                max="10"
                value={config.maxAgents || 3}
                onChange={(e) => updateConfig('maxAgents', parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="aggregationStrategy">Aggregation Strategy</Label>
              <Select
                value={config.aggregationStrategy || 'all'}
                onValueChange={(value) => updateConfig('aggregationStrategy', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first">First Result</SelectItem>
                  <SelectItem value="all">All Results</SelectItem>
                  <SelectItem value="majority">Majority Vote</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      default:
        return <div>No configuration available for this node type.</div>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          Node Properties
          <Button
            variant="outline"
            size="sm"
            onClick={onDeleteNode}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="label">Label</Label>
          <Input
            id="label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Node label"
          />
        </div>

        <div>
          <Label>Type</Label>
          <div className="text-sm text-gray-600 capitalize">
            {node.type?.replace('-', ' ') || 'Unknown'}
          </div>
        </div>

        {renderConfigFields()}

        <Button onClick={handleSave} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}
