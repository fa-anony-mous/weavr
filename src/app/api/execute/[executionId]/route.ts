import { NextRequest, NextResponse } from 'next/server';
import { redisClient } from '@/lib/redis';
import { WorkflowExecutor } from '@/lib/workflow-engine/executor';
import { ExecutionStatusResponse } from '@/types/workflow';

// GET /api/execute/[executionId] - Get execution status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  try {
    const { executionId } = await params;
    
    if (!executionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Execution ID is required',
        },
        { status: 400 }
      );
    }

    // Get execution context
    const execution = await redisClient.getExecution(executionId);
    
    if (!execution) {
      return NextResponse.json(
        {
          success: false,
          error: 'Execution not found',
        },
        { status: 404 }
      );
    }

    // Determine if execution is complete
    const isComplete = ['completed', 'failed', 'cancelled'].includes(execution.status);
    
    // Calculate next poll interval
    let nextPollIn: number | undefined;
    if (!isComplete) {
      // Poll every 2 seconds for running executions
      nextPollIn = 2000;
    }

    const response: ExecutionStatusResponse = {
      execution,
      isComplete,
      nextPollIn,
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error fetching execution status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch execution status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST /api/execute/[executionId]/resume - Resume a paused execution
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  try {
    const { executionId } = await params;
    
    if (!executionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Execution ID is required',
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { approvalData } = body || {};

    // Create executor and resume execution
    const executor = new WorkflowExecutor();
    const result = await executor.resumeExecution(executionId, approvalData);

    return NextResponse.json({
      success: result.success,
      data: result,
      message: result.success ? 'Execution resumed successfully' : 'Failed to resume execution',
    });
  } catch (error) {
    console.error('Error resuming execution:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to resume execution',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/execute/[executionId] - Cancel an execution
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  try {
    const { executionId } = await params;
    
    if (!executionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Execution ID is required',
        },
        { status: 400 }
      );
    }

    // Create executor and cancel execution
    const executor = new WorkflowExecutor();
    const success = await executor.cancelExecution(executionId);

    return NextResponse.json({
      success,
      message: success ? 'Execution cancelled successfully' : 'Failed to cancel execution',
    });
  } catch (error) {
    console.error('Error cancelling execution:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to cancel execution',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
