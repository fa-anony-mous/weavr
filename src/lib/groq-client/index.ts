import Groq from 'groq-sdk';
import { AgentNodeConfig } from '@/types/workflow';

export interface GroqOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface GroqResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason?: string;
}

export class GroqClient {
  private client: Groq;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY environment variable is required');
    }
    
    this.client = new Groq({
      apiKey: apiKey,
    });
  }

  /**
   * Call Groq LLM with a simple prompt (alias for callGroqAgent)
   */
  async callAgent(
    prompt: string,
    context: Record<string, any> = {},
    options: GroqOptions = {}
  ): Promise<GroqResponse> {
    return this.callGroqAgent(prompt, context, options);
  }

  /**
   * Call Groq LLM with a simple prompt
   */
  async callGroqAgent(
    prompt: string,
    context: Record<string, any> = {},
    options: GroqOptions = {}
  ): Promise<GroqResponse> {
    try {
      const {
        model = 'llama-3.1-70b-versatile',
        temperature = 0.7,
        maxTokens = 1000,
        systemPrompt = 'You are an intelligent agent in a workflow orchestration system.'
      } = options;

      // Replace variables in prompt with context values
      const processedPrompt = this.replaceVariables(prompt, context);

      const completion = await this.client.chat.completions.create({
        messages: [
          { 
            role: 'system', 
            content: systemPrompt 
          },
          { 
            role: 'user', 
            content: processedPrompt 
          }
        ],
        model,
        temperature,
        max_tokens: maxTokens,
      });

      const choice = completion.choices[0];
      if (!choice?.message?.content) {
        throw new Error('No content returned from Groq API');
      }

      return {
        content: choice.message.content,
        usage: completion.usage ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        } : undefined,
        model: completion.model,
        finishReason: choice.finish_reason,
      };
    } catch (error) {
      console.error('Groq API Error:', error);
      throw new Error(`Groq API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute an agent node with its configuration
   */
  async executeAgentNode(
    config: AgentNodeConfig,
    context: Record<string, any> = {}
  ): Promise<GroqResponse> {
    const options: GroqOptions = {
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      systemPrompt: config.systemPrompt,
    };

    return this.callGroqAgent(config.promptTemplate, context, options);
  }

  /**
   * Generate workflow JSON from natural language requirements
   */
  async generateWorkflow(
    requirements: string,
    context: Record<string, any> = {}
  ): Promise<string> {
    const systemPrompt = `You are an expert workflow automation designer. 
    Generate valid JSON for a workflow orchestration system based on user requirements.
    
    The workflow should follow this structure:
    {
      "id": "unique-id",
      "name": "Workflow Name",
      "description": "Brief description",
      "nodes": [
        {
          "id": "node-id",
          "type": "trigger|action|agent|human-approval|condition|loop|spawn-agent",
          "data": {
            "label": "Node Label",
            "config": { /* node-specific config */ }
          },
          "position": { "x": 0, "y": 0 }
        }
      ],
      "edges": [
        {
          "id": "edge-id",
          "source": "source-node-id",
          "target": "target-node-id",
          "condition": "optional condition"
        }
      ],
      "metadata": {
        "createdAt": "ISO timestamp",
        "version": 1
      }
    }
    
    Node types and their configs:
    - trigger: { triggerType: "webhook|manual|schedule" }
    - action: { actionType: "http-request|data-transform|notification|custom" }
    - agent: { promptTemplate: "prompt", model: "model", temperature: 0.7 }
    - human-approval: { approvalMessage: "message", timeoutMinutes: 60 }
    - condition: { expression: "JavaScript expression" }
    - loop: { maxIterations: 10, exitCondition: "optional expression" }
    - spawn-agent: { agentPrompt: "prompt", maxAgents: 3, aggregationStrategy: "all" }
    
    Generate a complete, valid JSON workflow. Output only the JSON, no other text.`;

    const prompt = `User requirements: ${requirements}
    
    Context: ${JSON.stringify(context, null, 2)}
    
    Generate a workflow JSON that automates this process.`;

    const response = await this.callGroqAgent(prompt, context, {
      systemPrompt,
      temperature: 0.3, // Lower temperature for more consistent JSON
      maxTokens: 2000,
    });

    return response.content;
  }

  /**
   * Generate workflow suggestions based on partial requirements
   */
  async suggestWorkflowImprovements(
    currentWorkflow: string,
    userFeedback: string,
    context: Record<string, any> = {}
  ): Promise<string> {
    const systemPrompt = `You are a workflow optimization expert. 
    Analyze the current workflow and user feedback to suggest improvements.
    Provide specific, actionable recommendations.`;

    const prompt = `Current workflow:
    ${currentWorkflow}
    
    User feedback: ${userFeedback}
    
    Context: ${JSON.stringify(context, null, 2)}
    
    Suggest specific improvements to make this workflow better.`;

    return (await this.callGroqAgent(prompt, context, { systemPrompt })).content;
  }

  /**
   * Replace variables in prompt template with context values
   */
  private replaceVariables(prompt: string, context: Record<string, any>): string {
    let processedPrompt = prompt;
    
    // Replace {{variable}} patterns
    const variablePattern = /\{\{(\w+)\}\}/g;
    processedPrompt = processedPrompt.replace(variablePattern, (match, variableName) => {
      const value = context[variableName];
      return value !== undefined ? String(value) : match;
    });

    // Replace ${variable} patterns
    const dollarPattern = /\$\{(\w+)\}/g;
    processedPrompt = processedPrompt.replace(dollarPattern, (match, variableName) => {
      const value = context[variableName];
      return value !== undefined ? String(value) : match;
    });

    return processedPrompt;
  }

  /**
   * Validate if a string is valid JSON
   */
  static isValidJSON(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract JSON from a response that might contain other text
   */
  static extractJSON(response: string): string | null {
    // Try to find JSON object in the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[0];
      if (this.isValidJSON(jsonStr)) {
        return jsonStr;
      }
    }
    return null;
  }
}

// Export singleton instance
export const groqClient = new GroqClient();
