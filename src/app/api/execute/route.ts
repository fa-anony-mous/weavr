import { NextRequest, NextResponse } from 'next/server';
import { redisClient } from '@/lib/redis';
import { WorkflowExecutor } from '@/lib/workflow-engine/executor';
import { ExecuteWorkflowRequest, ExecuteWorkflowResponse } from '@/types/workflow';
import { z } from 'zod';

// Validation schema
const ExecuteWorkflowSchema = z.object({
  workflowId: z.string().min(1, 'Workflow ID is required'),
  triggerData: z.record(z.string(), z.any()).default({}),
  variables: z.record(z.string(), z.any()).optional(),
});

// POST /api/execute - Start workflow execution
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validationResult = ExecuteWorkflowSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { workflowId, triggerData, variables = {} } = validationResult.data;

    // Get workflow
    const workflow = await redisClient.getWorkflow(workflowId);
    if (!workflow) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workflow not found',
        },
        { status: 404 }
      );
    }

    // Validate workflow before execution
    const validation = WorkflowExecutor.validateWorkflow(workflow);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid workflow structure',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    // Create executor and start execution
    const executor = new WorkflowExecutor();
    const input = { ...triggerData, ...variables };
    
    // Start execution asynchronously
    const executionPromise = executor.executeWorkflow(workflow, input);
    
    // Return immediately with execution ID
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Start execution in background
    executionPromise.catch(error => {
      console.error('Workflow execution failed:', error);
    });

    const response: ExecuteWorkflowResponse = {
      executionId,
      status: 'running',
      message: 'Workflow execution started',
    };

    return NextResponse.json({
      success: true,
      data: response,
    }, { status: 202 });
  } catch (error) {
    console.error('Error starting workflow execution:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to start workflow execution',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
