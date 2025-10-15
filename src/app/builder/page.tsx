'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkflowBuilder } from '@/components/workflow/workflow-builder';
import { Workflow, WorkflowNode, WorkflowEdge } from '@/types/workflow';
import { Save, Play, Download, Upload } from 'lucide-react';

export default function BuilderPage() {
  const [workflow, setWorkflow] = useState<Workflow>({
    id: '',
    name: 'New Workflow',
    description: 'A new workflow',
    nodes: [],
    edges: [],
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    },
  });

  const [isExecuting, setIsExecuting] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(null);

  const handleWorkflowChange = useCallback((newWorkflow: Workflow) => {
    setWorkflow(newWorkflow);
  }, []);

  const handleSave = async () => {
    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workflow),
      });

      if (response.ok) {
        const result = await response.json();
        setWorkflow(result.data);
        alert('Workflow saved successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to save workflow: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
      alert('Failed to save workflow');
    }
  };

  const handleExecute = async () => {
    if (!workflow.id) {
      alert('Please save the workflow before executing');
      return;
    }

    setIsExecuting(true);
    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowId: workflow.id,
          triggerData: { test: true },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setExecutionId(result.data.executionId);
        alert(`Workflow execution started! Execution ID: ${result.data.executionId}`);
      } else {
        const error = await response.json();
        alert(`Failed to execute workflow: ${error.error}`);
      }
    } catch (error) {
      console.error('Error executing workflow:', error);
      alert('Failed to execute workflow');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(workflow, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${workflow.name.replace(/\s+/g, '_')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedWorkflow = JSON.parse(e.target?.result as string);
        setWorkflow(importedWorkflow);
        alert('Workflow imported successfully!');
      } catch (error) {
        alert('Failed to import workflow: Invalid JSON');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between py-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workflow Builder</h1>
            <p className="text-gray-600">Design and build intelligent workflows</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
              id="import-file"
            />
            <label htmlFor="import-file">
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </label>
            
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            
            <Button size="sm" onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            
            <Button 
              size="sm" 
              onClick={handleExecute}
              disabled={isExecuting || !workflow.id}
              className="bg-green-600 hover:bg-green-700"
            >
              <Play className="h-4 w-4 mr-2" />
              {isExecuting ? 'Executing...' : 'Execute'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex h-[calc(100vh-80px)] min-w-0 overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 p-6 overflow-y-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Workflow Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={workflow.name}
                  onChange={(e) => setWorkflow(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={workflow.description}
                  onChange={(e) => setWorkflow(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Statistics</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <div>Nodes: {workflow.nodes.length}</div>
                  <div>Connections: {workflow.edges.length}</div>
                  <div>Version: {workflow.metadata.version}</div>
                </div>
              </div>

              {executionId && (
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Execution</h3>
                  <div className="text-sm text-gray-600">
                    <div>ID: {executionId}</div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="mt-2"
                      onClick={() => window.open(`/monitor/${executionId}`, '_blank')}
                    >
                      View Execution
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Workflow Canvas */}
        <div className="flex-1 min-w-0">
          <WorkflowBuilder
            workflow={workflow}
            onWorkflowChange={handleWorkflowChange}
          />
        </div>
      </div>
    </div>
  );
}
