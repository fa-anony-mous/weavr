import { ExecutionContext, Workflow, WorkflowNode } from '@/types/workflow';

export interface ExecutionMetrics {
  executionId: string;
  workflowId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
  nodeMetrics: NodeMetrics[];
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  pausedNodes: number;
  averageNodeDuration: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

export interface NodeMetrics {
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  retryCount: number;
  errorCount: number;
  lastError?: string;
  inputSize?: number;
  outputSize?: number;
  memoryUsage?: number;
}

export interface WorkflowHealth {
  workflowId: string;
  healthScore: number; // 0-100
  status: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
  recommendations: string[];
  lastExecution?: ExecutionMetrics;
  averageExecutionTime: number;
  successRate: number;
  errorRate: number;
}

export class WorkflowMonitor {
  private static instance: WorkflowMonitor;
  private metrics: Map<string, ExecutionMetrics> = new Map();
  private nodeMetrics: Map<string, NodeMetrics[]> = new Map();

  static getInstance(): WorkflowMonitor {
    if (!WorkflowMonitor.instance) {
      WorkflowMonitor.instance = new WorkflowMonitor();
    }
    return WorkflowMonitor.instance;
  }

  /**
   * Start monitoring an execution
   */
  startExecution(executionId: string, workflowId: string): void {
    const metrics: ExecutionMetrics = {
      executionId,
      workflowId,
      startTime: new Date().toISOString(),
      status: 'running',
      nodeMetrics: [],
      totalNodes: 0,
      completedNodes: 0,
      failedNodes: 0,
      pausedNodes: 0,
      averageNodeDuration: 0,
    };

    this.metrics.set(executionId, metrics);
    this.nodeMetrics.set(executionId, []);
  }

  /**
   * End monitoring an execution
   */
  endExecution(executionId: string, status: 'completed' | 'failed' | 'cancelled'): void {
    const metrics = this.metrics.get(executionId);
    if (!metrics) return;

    const endTime = new Date().toISOString();
    const duration = new Date(endTime).getTime() - new Date(metrics.startTime).getTime();

    metrics.endTime = endTime;
    metrics.duration = duration;
    metrics.status = status;

    // Calculate average node duration
    const nodeMetrics = this.nodeMetrics.get(executionId) || [];
    const completedNodes = nodeMetrics.filter(n => n.status === 'completed' && n.duration);
    if (completedNodes.length > 0) {
      metrics.averageNodeDuration = completedNodes.reduce((sum, n) => sum + (n.duration || 0), 0) / completedNodes.length;
    }

    this.metrics.set(executionId, metrics);
  }

  /**
   * Start monitoring a node
   */
  startNode(executionId: string, node: WorkflowNode): void {
    const nodeMetrics: NodeMetrics = {
      nodeId: node.id,
      nodeType: node.type,
      nodeLabel: node.data.label,
      startTime: new Date().toISOString(),
      status: 'running',
      retryCount: 0,
      errorCount: 0,
    };

    const existingMetrics = this.nodeMetrics.get(executionId) || [];
    existingMetrics.push(nodeMetrics);
    this.nodeMetrics.set(executionId, existingMetrics);

    // Update execution metrics
    const executionMetrics = this.metrics.get(executionId);
    if (executionMetrics) {
      executionMetrics.totalNodes++;
      this.metrics.set(executionId, executionMetrics);
    }
  }

  /**
   * End monitoring a node
   */
  endNode(
    executionId: string,
    nodeId: string,
    status: 'completed' | 'failed' | 'skipped',
    error?: string
  ): void {
    const nodeMetricsList = this.nodeMetrics.get(executionId) || [];
    const nodeMetric = nodeMetricsList.find(n => n.nodeId === nodeId);
    
    if (nodeMetric) {
      const endTime = new Date().toISOString();
      const duration = new Date(endTime).getTime() - new Date(nodeMetric.startTime).getTime();

      nodeMetric.endTime = endTime;
      nodeMetric.duration = duration;
      nodeMetric.status = status;
      
      if (error) {
        nodeMetric.lastError = error;
        nodeMetric.errorCount++;
      }

      this.nodeMetrics.set(executionId, nodeMetricsList);

      // Update execution metrics
      const executionMetrics = this.metrics.get(executionId);
      if (executionMetrics) {
        switch (status) {
          case 'completed':
            executionMetrics.completedNodes++;
            break;
          case 'failed':
            executionMetrics.failedNodes++;
            break;
          case 'skipped':
            // Don't count skipped nodes
            break;
        }
        this.metrics.set(executionId, executionMetrics);
      }
    }
  }

  /**
   * Record a node retry
   */
  recordNodeRetry(executionId: string, nodeId: string): void {
    const nodeMetricsList = this.nodeMetrics.get(executionId) || [];
    const nodeMetric = nodeMetricsList.find(n => n.nodeId === nodeId);
    
    if (nodeMetric) {
      nodeMetric.retryCount++;
      this.nodeMetrics.set(executionId, nodeMetricsList);
    }
  }

  /**
   * Record a node error
   */
  recordNodeError(executionId: string, nodeId: string, error: string): void {
    const nodeMetricsList = this.nodeMetrics.get(executionId) || [];
    const nodeMetric = nodeMetricsList.find(n => n.nodeId === nodeId);
    
    if (nodeMetric) {
      nodeMetric.errorCount++;
      nodeMetric.lastError = error;
      this.nodeMetrics.set(executionId, nodeMetricsList);
    }
  }

  /**
   * Get execution metrics
   */
  getExecutionMetrics(executionId: string): ExecutionMetrics | undefined {
    return this.metrics.get(executionId);
  }

  /**
   * Get node metrics for an execution
   */
  getNodeMetrics(executionId: string): NodeMetrics[] {
    return this.nodeMetrics.get(executionId) || [];
  }

  /**
   * Get workflow health
   */
  getWorkflowHealth(workflowId: string): WorkflowHealth {
    const executions = Array.from(this.metrics.values()).filter(m => m.workflowId === workflowId);
    
    if (executions.length === 0) {
      return {
        workflowId,
        healthScore: 100,
        status: 'healthy',
        issues: [],
        recommendations: [],
        averageExecutionTime: 0,
        successRate: 100,
        errorRate: 0,
      };
    }

    const completedExecutions = executions.filter(e => e.status === 'completed');
    const failedExecutions = executions.filter(e => e.status === 'failed');
    const successRate = (completedExecutions.length / executions.length) * 100;
    const errorRate = (failedExecutions.length / executions.length) * 100;

    const averageExecutionTime = executions.reduce((sum, e) => sum + (e.duration || 0), 0) / executions.length;

    let healthScore = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Calculate health score based on various factors
    if (successRate < 80) {
      healthScore -= 30;
      issues.push(`Low success rate: ${successRate.toFixed(1)}%`);
      recommendations.push('Review failed executions and fix common issues');
    }

    if (errorRate > 20) {
      healthScore -= 25;
      issues.push(`High error rate: ${errorRate.toFixed(1)}%`);
      recommendations.push('Implement better error handling and retry logic');
    }

    if (averageExecutionTime > 300000) { // 5 minutes
      healthScore -= 20;
      issues.push(`Long execution times: ${(averageExecutionTime / 1000).toFixed(1)}s average`);
      recommendations.push('Optimize workflow performance and consider parallel execution');
    }

    // Check for recent failures
    const recentExecutions = executions.filter(e => {
      const executionTime = new Date(e.startTime).getTime();
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      return executionTime > oneHourAgo;
    });

    const recentFailureRate = recentExecutions.filter(e => e.status === 'failed').length / recentExecutions.length;
    if (recentFailureRate > 0.5) {
      healthScore -= 25;
      issues.push(`Recent high failure rate: ${(recentFailureRate * 100).toFixed(1)}%`);
      recommendations.push('Investigate recent failures and check system health');
    }

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthScore >= 80) {
      status = 'healthy';
    } else if (healthScore >= 50) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      workflowId,
      healthScore: Math.max(0, healthScore),
      status,
      issues,
      recommendations,
      lastExecution: executions[executions.length - 1],
      averageExecutionTime,
      successRate,
      errorRate,
    };
  }

  /**
   * Get all execution metrics
   */
  getAllExecutionMetrics(): ExecutionMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Clear old metrics (cleanup)
   */
  clearOldMetrics(olderThanHours: number = 24): void {
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
    
    for (const [executionId, metrics] of this.metrics.entries()) {
      const executionTime = new Date(metrics.startTime).getTime();
      if (executionTime < cutoffTime) {
        this.metrics.delete(executionId);
        this.nodeMetrics.delete(executionId);
      }
    }
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): {
    executions: ExecutionMetrics[];
    nodeMetrics: Record<string, NodeMetrics[]>;
    health: Record<string, WorkflowHealth>;
  } {
    const executions = this.getAllExecutionMetrics();
    const nodeMetrics: Record<string, NodeMetrics[]> = {};
    const health: Record<string, WorkflowHealth> = {};

    // Get unique workflow IDs
    const workflowIds = [...new Set(executions.map(e => e.workflowId))];

    // Export node metrics
    for (const [executionId, metrics] of this.nodeMetrics.entries()) {
      nodeMetrics[executionId] = metrics;
    }

    // Export health for each workflow
    for (const workflowId of workflowIds) {
      health[workflowId] = this.getWorkflowHealth(workflowId);
    }

    return {
      executions,
      nodeMetrics,
      health,
    };
  }
}
