import { NextRequest, NextResponse } from 'next/server';
import { ApprovalExecutor } from '@/lib/nodes/approval-executor';
import { z } from 'zod';

// Validation schema
const RejectRequestSchema = z.object({
  rejectedBy: z.string().min(1, 'Rejector name is required'),
  reason: z.string().optional(),
});

// POST /api/approvals/[executionId]/reject - Reject a pending approval
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
    const validationResult = RejectRequestSchema.safeParse(body);
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

    const { rejectedBy, reason } = validationResult.data;

    // Reject the execution
    const approvalExecutor = new ApprovalExecutor();
    const result = await approvalExecutor.reject(executionId, rejectedBy, reason);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to reject execution',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Execution rejected successfully',
    });
  } catch (error) {
    console.error('Error rejecting execution:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to reject execution',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
