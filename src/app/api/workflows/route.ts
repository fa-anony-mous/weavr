import { NextRequest, NextResponse } from 'next/server';
import { redisClient } from '@/lib/redis';
import { Workflow, CreateWorkflowRequest } from '@/types/workflow';
import { WorkflowExecutor } from '@/lib/workflow-engine/executor';
import { z } from 'zod';

// Validation schemas
const CreateWorkflowSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
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
  })),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    condition: z.string().optional(),
    label: z.string().optional(),
  })),
});

// GET /api/workflows - List all workflows
export async function GET() {
  try {
    const workflows = await redisClient.listWorkflows();
    
    return NextResponse.json({
      success: true,
      data: workflows,
      count: workflows.length,
    });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch workflows',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST /api/workflows - Create a new workflow
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validationResult = CreateWorkflowSchema.safeParse(body);
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

    const { name, description, nodes, edges } = validationResult.data;

    // Create workflow object
    const workflow: Workflow = {
      id: `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      nodes,
      edges,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
    };

    // Validate workflow structure
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

    // Save workflow
    await redisClient.saveWorkflow(workflow);

    return NextResponse.json({
      success: true,
      data: workflow,
      message: 'Workflow created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating workflow:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create workflow',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
