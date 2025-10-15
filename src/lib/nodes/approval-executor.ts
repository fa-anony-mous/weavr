import { WorkflowNode, ExecutionContext, ApprovalNodeConfig, ApprovalRequest } from '@/types/workflow';
import { redisClient } from '@/lib/redis';

export interface ApprovalResult {
  success: boolean;
  data: Record<string, any>;
  error?: string;
  requiresApproval: boolean;
  approvalId?: string;
}

export class ApprovalExecutor {
  async execute(
    node: WorkflowNode,
    context: ExecutionContext
  ): Promise<ApprovalResult> {
    try {
      const config = node.data.config as ApprovalNodeConfig;
      
      // Validate configuration
      const validation = ApprovalExecutor.validateConfig(config);
      if (!validation.isValid) {
        throw new Error(`Invalid approval configuration: ${validation.errors.join(', ')}`);
      }

      // Create approval request
      const approvalRequest: ApprovalRequest = {
        executionId: context.executionId,
        nodeId: node.id,
        message: config.approvalMessage,
        data: {
          ...context.variables,
          stepResults: context.stepResults,
          nodeLabel: node.data.label,
        },
        timeoutAt: config.timeoutMinutes 
          ? new Date(Date.now() + config.timeoutMinutes * 60 * 1000).toISOString()
          : undefined,
      };

      // Save approval request to Redis
      await redisClient.saveApprovalRequest(approvalRequest);

      // Update execution context to paused status
      await redisClient.updateExecutionStatus(
        context.executionId,
        'paused',
        {
          currentNodeId: node.id,
          stepResults: {
            ...context.stepResults,
            [node.id]: {
              status: 'pending_approval',
              message: config.approvalMessage,
              requestedAt: new Date().toISOString(),
              timeoutAt: approvalRequest.timeoutAt,
            },
          },
        }
      );

      return {
        success: true,
        data: {
          approvalRequest,
          message: config.approvalMessage,
          timeoutAt: approvalRequest.timeoutAt,
        },
        requiresApproval: true,
        approvalId: context.executionId,
      };
    } catch (error) {
      return {
        success: false,
        data: {},
        error: error instanceof Error ? error.message : 'Unknown error',
        requiresApproval: false,
      };
    }
  }

  /**
   * Check if an approval request exists and is still valid
   */
  async checkApprovalStatus(executionId: string): Promise<{
    exists: boolean;
    isExpired: boolean;
    approval?: ApprovalRequest;
  }> {
    try {
      const approval = await redisClient.getApprovalRequest(executionId);
      
      if (!approval) {
        return { exists: false, isExpired: false };
      }

      const isExpired = approval.timeoutAt 
        ? new Date(approval.timeoutAt) < new Date()
        : false;

      return {
        exists: true,
        isExpired,
        approval,
      };
    } catch (error) {
      console.error('Error checking approval status:', error);
      return { exists: false, isExpired: false };
    }
  }

  /**
   * Approve a pending approval
   */
  async approve(
    executionId: string,
    approvedBy: string,
    reason?: string,
    additionalData?: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const approval = await redisClient.getApprovalRequest(executionId);
      
      if (!approval) {
        return { success: false, error: 'Approval request not found' };
      }

      // Check if approval has expired
      if (approval.timeoutAt && new Date(approval.timeoutAt) < new Date()) {
        await redisClient.deleteApprovalRequest(executionId);
        return { success: false, error: 'Approval request has expired' };
      }

      // Update execution context with approval result
      await redisClient.updateExecutionStatus(
        executionId,
        'running',
        {
          stepResults: {
            [approval.nodeId]: {
              status: 'approved',
              approvedBy,
              reason,
              additionalData,
              approvedAt: new Date().toISOString(),
            },
          },
        }
      );

      // Delete the approval request
      await redisClient.deleteApprovalRequest(executionId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Reject a pending approval
   */
  async reject(
    executionId: string,
    rejectedBy: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const approval = await redisClient.getApprovalRequest(executionId);
      
      if (!approval) {
        return { success: false, error: 'Approval request not found' };
      }

      // Update execution context with rejection result
      await redisClient.updateExecutionStatus(
        executionId,
        'failed',
        {
          stepResults: {
            [approval.nodeId]: {
              status: 'rejected',
              rejectedBy,
              reason,
              rejectedAt: new Date().toISOString(),
            },
          },
          error: `Approval rejected: ${reason || 'No reason provided'}`,
        }
      );

      // Delete the approval request
      await redisClient.deleteApprovalRequest(executionId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get all pending approvals
   */
  async getPendingApprovals(): Promise<ApprovalRequest[]> {
    try {
      // This is a simplified implementation
      // In production, you'd want to maintain a list of pending approvals
      const executions = await redisClient.listExecutions();
      const pendingApprovals: ApprovalRequest[] = [];

      for (const execution of executions) {
        if (execution.status === 'paused') {
          const approval = await redisClient.getApprovalRequest(execution.executionId);
          if (approval) {
            pendingApprovals.push(approval);
          }
        }
      }

      return pendingApprovals;
    } catch (error) {
      console.error('Error getting pending approvals:', error);
      return [];
    }
  }

  /**
   * Clean up expired approvals
   */
  async cleanupExpiredApprovals(): Promise<number> {
    try {
      const pendingApprovals = await this.getPendingApprovals();
      let cleanedCount = 0;

      for (const approval of pendingApprovals) {
        if (approval.timeoutAt && new Date(approval.timeoutAt) < new Date()) {
          await this.reject(
            approval.executionId,
            'system',
            'Approval request expired'
          );
          cleanedCount++;
        }
      }

      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning up expired approvals:', error);
      return 0;
    }
  }

  /**
   * Validate approval configuration
   */
  static validateConfig(config: ApprovalNodeConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.approvalMessage) {
      errors.push('Approval message is required');
    }

    if (config.timeoutMinutes && (config.timeoutMinutes < 1 || config.timeoutMinutes > 10080)) {
      errors.push('Timeout must be between 1 minute and 1 week (10080 minutes)');
    }

    if (config.approverEmail && !this.isValidEmail(config.approverEmail)) {
      errors.push('Invalid approver email format');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate email format
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get default configuration
   */
  static getDefaultConfig(): Partial<ApprovalNodeConfig> {
    return {
      approvalMessage: 'Please review and approve this step',
      timeoutMinutes: 60,
      requireReason: false,
    };
  }
}
