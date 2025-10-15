import { NextRequest, NextResponse } from 'next/server';
import { ApprovalExecutor } from '@/lib/nodes/approval-executor';
import { z } from 'zod';

// Validation schema
const ApproveRequestSchema = z.object({
  approvedBy: z.string().min(1, 'Approver name is required'),
  reason: z.string().optional(),
  data: z.record(z.string(), z.any()).optional(),
});

// POST /api/approvals/[executionId]/approve - Approve a pending approval
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
    
    // Validate request body
    const validationResult = ApproveRequestSchema.safeParse(body);
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

    const { approvedBy, reason, data } = validationResult.data;

    // Approve the execution
    const approvalExecutor = new ApprovalExecutor();
    const result = await approvalExecutor.approve(executionId, approvedBy, reason, data);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to approve execution',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Execution approved successfully',
    });
  } catch (error) {
    console.error('Error approving execution:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to approve execution',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
