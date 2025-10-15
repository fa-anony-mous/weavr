import { NextRequest, NextResponse } from 'next/server';
import { groqClient } from '@/lib/groq-client';
import { redisClient } from '@/lib/redis';
import { CopilotMessage, CopilotSession } from '@/types/workflow';
import { z } from 'zod';

// Validation schema
const ChatRequestSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1, 'Message is required'),
  context: z.record(z.string(), z.any()).optional(),
});

// POST /api/copilot/chat - Handle copilot chat
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validationResult = ChatRequestSchema.safeParse(body);
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

    const { sessionId, message, context = {} } = validationResult.data;

    // Get or create session
    let session: CopilotSession;
    if (sessionId) {
      const existingSession = await redisClient.getCopilotSession(sessionId);
      if (existingSession) {
        session = existingSession;
      } else {
        session = await createNewSession();
      }
    } else {
      session = await createNewSession();
    }

    // Add user message
    const userMessage: CopilotMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    session.messages.push(userMessage);

    // Determine conversation step and generate response
    const response = await generateCopilotResponse(session, context);
    
    // Add assistant message
    const assistantMessage: CopilotMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'assistant',
      content: response.content,
      timestamp: new Date().toISOString(),
      metadata: response.metadata,
    };

    session.messages.push(assistantMessage);
    session.updatedAt = new Date().toISOString();

    // Update session step if needed
    if (response.nextStep) {
      session.currentStep = response.nextStep as 'requirements' | 'generation' | 'refinement' | 'complete';
    }

    // Save session
    await redisClient.saveCopilotSession(session);

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        message: assistantMessage,
        currentStep: session.currentStep,
        requirements: session.requirements,
        generatedWorkflow: session.generatedWorkflow,
      },
    });
  } catch (error) {
    console.error('Error in copilot chat:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process chat message',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Create a new copilot session
async function createNewSession(): Promise<CopilotSession> {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id: sessionId,
    messages: [],
    currentStep: 'requirements',
    requirements: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Generate copilot response based on current step
async function generateCopilotResponse(
  session: CopilotSession,
  context: Record<string, any>
): Promise<{ content: string; metadata?: any; nextStep?: string }> {
  const lastMessage = session.messages[session.messages.length - 1];
  
  switch (session.currentStep) {
    case 'requirements':
      return await handleRequirementsStep(session, lastMessage.content);
    
    case 'generation':
      return await handleGenerationStep(session, lastMessage.content);
    
    case 'refinement':
      return await handleRefinementStep(session, lastMessage.content);
    
    default:
      return {
        content: "I'm here to help you build workflows. What would you like to automate?",
      };
  }
}

// Handle requirements gathering step
async function handleRequirementsStep(
  session: CopilotSession,
  message: string
): Promise<{ content: string; metadata?: any; nextStep?: string }> {
  const requirements = session.requirements;
  
  // Check if we have all required information
  const hasAllRequirements = 
    requirements.businessProcess && 
    requirements.triggers && 
    requirements.decisions !== undefined;

  if (hasAllRequirements) {
    return {
      content: "Great! I have all the information I need. Let me generate a workflow for you.",
      nextStep: 'generation',
    };
  }

  // Determine what to ask next
  let question = "";
  let nextRequirement = "";

  if (!requirements.businessProcess) {
    question = "What business process would you like to automate? Please describe what you want to achieve.";
    nextRequirement = "businessProcess";
  } else if (!requirements.triggers) {
    question = "What should trigger this workflow? (e.g., webhook, manual start, scheduled time, etc.)";
    nextRequirement = "triggers";
  } else if (requirements.decisions === undefined) {
    question = "Are there any decisions or conditions that need to be made in this workflow? (e.g., approval steps, conditional branching)";
    nextRequirement = "decisions";
  } else if (!requirements.approvals) {
    question = "Do you need any human approvals in this workflow?";
    nextRequirement = "approvals";
  } else if (!requirements.integrations) {
    question = "Are there any external integrations or data sources needed?";
    nextRequirement = "integrations";
  } else if (!requirements.constraints) {
    question = "Are there any constraints or special requirements I should know about?";
    nextRequirement = "constraints";
  }

  // Update requirements based on the message
  if (nextRequirement) {
    const extractedInfo = await extractRequirementInfo(message, nextRequirement);
    if (extractedInfo) {
      (requirements as any)[nextRequirement] = extractedInfo;
    }
  }

  return {
    content: question,
    metadata: { nextRequirement, requirements },
  };
}

// Handle workflow generation step
async function handleGenerationStep(
  session: CopilotSession,
  message: string
): Promise<{ content: string; metadata?: any; nextStep?: string }> {
  try {
    // Generate workflow using Groq
    const prompt = `You are an expert workflow automation designer. Generate a valid workflow JSON based on these requirements:

${JSON.stringify(session.requirements, null, 2)}

Create a workflow with:
- A trigger node (type: "trigger")
- Action nodes for deterministic operations (type: "action")
- Agent nodes for AI-powered decisions (type: "agent")
- Human approval nodes if needed (type: "human-approval")
- Condition nodes for branching (type: "condition")

Return ONLY valid JSON with this structure:
{
  "id": "unique-id",
  "name": "Workflow Name",
  "description": "Brief description",
  "nodes": [{ "id": "node1", "type": "trigger", "data": {"label": "Start", "config": {}}, "position": {"x": 100, "y": 100} }],
  "edges": [{ "id": "edge1", "source": "node1", "target": "node2" }],
  "metadata": { "createdAt": "${new Date().toISOString()}", "version": 1 }
}`;

    const response = await groqClient.callAgent(prompt, {}, {
      temperature: 0.7,
      maxTokens: 2000,
    });

    // Parse and validate the generated workflow
    const workflow = JSON.parse(response.content);
    
    // Save the generated workflow
    session.generatedWorkflow = workflow;
    session.currentStep = 'refinement';

    return {
      content: `I've generated a workflow for you! Here's what I created:

**${workflow.name}**
${workflow.description}

The workflow includes ${workflow.nodes.length} steps and ${workflow.edges.length} connections.

Would you like me to:
1. Explain any part of the workflow in detail
2. Modify or add steps
3. Save this workflow to the builder
4. Generate a different version

What would you like to do next?`,
      metadata: { workflow },
      nextStep: 'refinement',
    };
  } catch (error) {
    return {
      content: "I had trouble generating the workflow. Could you provide more specific details about what you want to automate?",
    };
  }
}

// Handle refinement step
async function handleRefinementStep(
  session: CopilotSession,
  message: string
): Promise<{ content: string; metadata?: any; nextStep?: string }> {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('save') || lowerMessage.includes('builder')) {
    return {
      content: "Perfect! I'll save this workflow to the builder. You can now open the workflow builder to see and edit your workflow.",
      metadata: { action: 'save_to_builder' },
    };
  }
  
  if (lowerMessage.includes('modify') || lowerMessage.includes('change') || lowerMessage.includes('add')) {
    try {
      // Generate suggestions for modifications
      const prompt = `The user wants to modify this workflow:

${JSON.stringify(session.generatedWorkflow, null, 2)}

User request: ${message}

Provide 3-5 specific suggestions for improving or modifying the workflow based on the user's request.`;

      const response = await groqClient.callAgent(prompt, {}, {
        temperature: 0.7,
        maxTokens: 500,
      });

      const suggestions = response.content;

      return {
        content: `Here are some suggestions for improving your workflow:

${suggestions}

Would you like me to implement any of these changes, or do you have other specific modifications in mind?`,
      };
    } catch (error) {
      return {
        content: "I can help you modify the workflow. What specific changes would you like to make?",
      };
    }
  }
  
  if (lowerMessage.includes('explain') || lowerMessage.includes('detail')) {
    return {
      content: "I'd be happy to explain the workflow in detail. Which part would you like me to focus on?",
    };
  }
  
  if (lowerMessage.includes('different') || lowerMessage.includes('new') || lowerMessage.includes('regenerate')) {
    session.currentStep = 'generation';
    return {
      content: "I'll generate a different version of the workflow for you. Let me create an alternative approach.",
      nextStep: 'generation',
    };
  }

  return {
    content: "I'm here to help you refine your workflow. You can ask me to modify, explain, or save the workflow. What would you like to do?",
  };
}

// Extract requirement information from user message
async function extractRequirementInfo(
  message: string,
  requirementType: string
): Promise<any> {
  try {
    const prompt = `Extract ${requirementType} information from this message: "${message}"
    
    Return only the relevant information in a structured format. For example:
    - If it's about triggers, return an array of trigger types
    - If it's about business process, return a string description
    - If it's about decisions, return true/false or a description
    
    Be concise and extract only the essential information.`;

    const response = await groqClient.callAgent(prompt, {}, {
      temperature: 0.3,
      maxTokens: 200,
    });

    // Try to parse as JSON, fallback to text
    try {
      return JSON.parse(response.content);
    } catch {
      return response.content;
    }
  } catch (error) {
    console.error('Error extracting requirement info:', error);
    return null;
  }
}
