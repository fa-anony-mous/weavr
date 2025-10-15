import { NextRequest, NextResponse } from 'next/server';
import { redisClient } from '@/lib/redis';
import { Workflow } from '@/types/workflow';
import { WorkflowExecutor } from '@/lib/workflow-engine/executor';
import { z } from 'zod';

// GET /api/workflows/[id] - Get a specific workflow
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workflow ID is required',
        },
        { status: 400 }
      );
    }

    const workflow = await redisClient.getWorkflow(id);
    
    if (!workflow) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workflow not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch workflow',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// PUT /api/workflows/[id] - Update a workflow
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workflow ID is required',
        },
        { status: 400 }
      );
    }

    // Check if workflow exists
    const existingWorkflow = await redisClient.getWorkflow(id);
    if (!existingWorkflow) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workflow not found',
        },
        { status: 404 }
      );
    }

    const body = await request.json();
    
    // Validate request body
    const UpdateWorkflowSchema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      nodes: z.array(z.object({
        id: z.string(),
        type: z.enum(['trigger', 'action', 'agent', 'human-approval', 'condition', 'loop', 'spawn-agent']),
        data: z.object({
          label: z.string(),
          config: z.record(z.string(), z.any()),
        }),
        position: z.object({
          x: z.number(),
          y: z.number(),
        }),
      })).optional(),
      edges: z.array(z.object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
        condition: z.string().optional(),
        label: z.string().optional(),
      })).optional(),
    });

    const validationResult = UpdateWorkflowSchema.safeParse(body);
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

    // Update workflow
    const updatedWorkflow: Workflow = {
      ...existingWorkflow,
      ...validationResult.data,
      metadata: {
        ...existingWorkflow.metadata,
        updatedAt: new Date().toISOString(),
        version: existingWorkflow.metadata.version + 1,
      },
    };

    // Validate updated workflow structure
    const validation = WorkflowExecutor.validateWorkflow(updatedWorkflow);
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

    // Save updated workflow
    await redisClient.saveWorkflow(updatedWorkflow);

    return NextResponse.json({
      success: true,
      data: updatedWorkflow,
      message: 'Workflow updated successfully',
    });
  } catch (error) {
    console.error('Error updating workflow:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update workflow',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/workflows/[id] - Delete a workflow
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workflow ID is required',
        },
        { status: 400 }
      );
    }

    // Check if workflow exists
    const workflow = await redisClient.getWorkflow(id);
    if (!workflow) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workflow not found',
        },
        { status: 404 }
      );
    }

    // Delete workflow
    await redisClient.deleteWorkflow(id);

    return NextResponse.json({
      success: true,
      message: 'Workflow deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete workflow',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
