'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Pause, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { ExecutionContext, NodeStatus } from '@/types/workflow';

const statusColors = {
  running: 'bg-blue-500',
  paused: 'bg-yellow-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  cancelled: 'bg-gray-500',
};

const nodeStatusColors = {
  pending: 'bg-gray-400',
  running: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  skipped: 'bg-gray-300',
};

export default function MonitorPage() {
  const params = useParams();
  const executionId = params.executionId as string;
  
  const [execution, setExecution] = useState<ExecutionContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const fetchExecution = async () => {
    try {
      const response = await fetch(`/api/execute/${executionId}`);
      if (response.ok) {
        const result = await response.json();
        setExecution(result.data.execution);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch execution');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (executionId) {
      fetchExecution();
    }
  }, [executionId]);

  // Poll for updates if execution is still running
  useEffect(() => {
    if (execution && ['running', 'paused'].includes(execution.status)) {
      const interval = setInterval(() => {
        fetchExecution();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [execution]);

  const handleResume = async () => {
    if (!execution) return;
    
    setIsPolling(true);
    try {
      const response = await fetch(`/api/execute/${executionId}/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approvalData: { approved: true, timestamp: new Date().toISOString() },
        }),
      });

      if (response.ok) {
        await fetchExecution();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to resume execution');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setIsPolling(false);
    }
  };

  const handleCancel = async () => {
    if (!execution) return;
    
    try {
      const response = await fetch(`/api/execute/${executionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchExecution();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to cancel execution');
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'paused':
        return <Pause className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getNodeStatusIcon = (status: NodeStatus) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-3 w-3" />;
      case 'failed':
        return <XCircle className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading execution details...</p>
        </div>
      </div>
    );
  }

  if (error || !execution) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{error || 'Execution not found'}</p>
            <div className="flex space-x-2">
              <Button onClick={fetchExecution} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
              <Link href="/builder">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Builder
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between py-4">
          <div className="flex items-center space-x-4">
            <Link href="/builder">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Execution Monitor</h1>
              <p className="text-gray-600">ID: {executionId}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Badge 
              className={`${statusColors[execution.status]} text-white`}
            >
              {getStatusIcon(execution.status)}
              <span className="ml-1 capitalize">{execution.status}</span>
            </Badge>
            
            {execution.status === 'paused' && (
              <Button onClick={handleResume} disabled={isPolling}>
                <Play className="h-4 w-4 mr-2" />
                Resume
              </Button>
            )}
            
            {['running', 'paused'].includes(execution.status) && (
              <Button onClick={handleCancel} variant="outline">
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Execution Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Execution Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="font-medium text-gray-700">Workflow ID</h4>
                <p className="text-sm text-gray-600">{execution.workflowId}</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-700">Started At</h4>
                <p className="text-sm text-gray-600">
                  {new Date(execution.startedAt).toLocaleString()}
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-700">Last Updated</h4>
                <p className="text-sm text-gray-600">
                  {new Date(execution.updatedAt).toLocaleString()}
                </p>
              </div>
            </div>
            
            {execution.error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                <h4 className="font-medium text-red-800">Error</h4>
                <p className="text-sm text-red-600 mt-1">{execution.error}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step Results */}
        <Card>
          <CardHeader>
            <CardTitle>Step Results</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(execution.stepResults).length === 0 ? (
              <p className="text-gray-500 text-center py-4">No steps executed yet</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(execution.stepResults).map(([nodeId, result]) => (
                  <div key={nodeId} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{nodeId}</h4>
                      <Badge 
                        className={`${nodeStatusColors[execution.nodeStatuses[nodeId] || 'pending']} text-white`}
                      >
                        {getNodeStatusIcon(execution.nodeStatuses[nodeId] || 'pending')}
                        <span className="ml-1 capitalize">
                          {execution.nodeStatuses[nodeId] || 'pending'}
                        </span>
                      </Badge>
                    </div>
                    <div className="bg-gray-50 rounded p-3">
                      <pre className="text-xs text-gray-800 overflow-x-auto break-words">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Variables */}
        <Card>
          <CardHeader>
            <CardTitle>Execution Variables</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(execution.variables).length === 0 ? (
              <p className="text-gray-500 text-center py-4">No variables set</p>
            ) : (
              <div className="bg-gray-50 rounded p-3">
                <pre className="text-xs text-gray-800 overflow-x-auto break-words">
                  {JSON.stringify(execution.variables, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
