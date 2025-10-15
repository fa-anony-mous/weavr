import { Redis } from '@upstash/redis';
import { Workflow, ExecutionContext, ApprovalRequest, CopilotSession } from '@/types/workflow';

type SimpleRedisClient = {
  setex: (key: string, ttlSeconds: number, value: string) => Promise<void>;
  get: (key: string) => Promise<string | null>;
  del: (key: string) => Promise<void>;
  keys: (pattern: string) => Promise<string[]>;
  exists: (key: string) => Promise<number>;
  ttl: (key: string) => Promise<number>;
  publish: (channel: string, message: string) => Promise<void>;
  ping: () => Promise<void>;
};

class InMemoryRedis implements SimpleRedisClient {
  private store = new Map<string, { value: string; expiresAt: number }>();

  private now(): number {
    return Date.now();
  }

  private isExpired(entry: { value: string; expiresAt: number }): boolean {
    return entry.expiresAt !== -1 && this.now() > entry.expiresAt;
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    const expiresAt = ttlSeconds > 0 ? this.now() + ttlSeconds * 1000 : -1;
    this.store.set(key, { value, expiresAt });
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async keys(pattern: string): Promise<string[]> {
    // Support simple prefix:* matching
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return Array.from(this.store.keys()).filter(k => k.startsWith(prefix));
    }
    return Array.from(this.store.keys()).filter(k => k === pattern);
  }

  async exists(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return 0;
    }
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return -2; // key does not exist
    if (entry.expiresAt === -1) return -1; // no expiry
    const remainingMs = entry.expiresAt - this.now();
    if (remainingMs <= 0) {
      this.store.delete(key);
      return -2;
    }
    return Math.ceil(remainingMs / 1000);
  }

  async publish(_channel: string, _message: string): Promise<void> {
    // no-op in-memory
    return;
  }

  async ping(): Promise<void> {
    return;
  }
}

function createClient(): SimpleRedisClient {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  const looksValidUrl = typeof url === 'string' && url.startsWith('https://') && !url.includes('your_upstash_redis_url');
  const looksValidToken = typeof token === 'string' && token.length > 0 && !token.includes('your_');

  if (looksValidUrl && looksValidToken) {
    try {
      // Upstash client
      const upstash = new Redis({ url: url as string, token: token as string });
      // Adapt Upstash Redis to SimpleRedisClient shape
      return {
        setex: async (key, ttl, value) => {
          await upstash.setex(key, ttl, value);
        },
        get: async (key) => {
          const v = await upstash.get(key);
          return (typeof v === 'string' || v === null) ? v : JSON.stringify(v);
        },
        del: async (key) => {
          await upstash.del(key);
        },
        keys: async (pattern) => {
          return await upstash.keys(pattern);
        },
        exists: async (key) => {
          const res = await upstash.exists(key);
          return typeof res === 'number' ? res : (res ? 1 : 0);
        },
        ttl: async (key) => {
          return await upstash.ttl(key);
        },
        publish: async (channel, message) => {
          await upstash.publish(channel, message);
        },
        ping: async () => {
          await upstash.ping();
        },
      } as SimpleRedisClient;
    } catch (_) {
      // Fall through to in-memory if Upstash client throws during creation
    }
  }
  // Fallback when envs are missing/invalid
  return new InMemoryRedis();
}

export class RedisClient {
  private client: SimpleRedisClient;

  constructor() {
    this.client = createClient();
  }

  // Workflow operations
  async saveWorkflow(workflow: Workflow): Promise<void> {
    const key = `workflow:${workflow.id}`;
    await this.client.setex(key, 86400, JSON.stringify(workflow)); // 24 hours TTL
  }

  async getWorkflow(workflowId: string): Promise<Workflow | null> {
    const key = `workflow:${workflowId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data as string) : null;
  }

  async deleteWorkflow(workflowId: string): Promise<void> {
    const key = `workflow:${workflowId}`;
    await this.client.del(key);
  }

  async listWorkflows(): Promise<Workflow[]> {
    const keys = await this.client.keys('workflow:*');
    const workflows: Workflow[] = [];
    
    for (const key of keys) {
      const data = await this.client.get(key);
      if (data) {
        workflows.push(JSON.parse(data as string));
      }
    }
    
    return workflows.sort((a, b) => 
      new Date(b.metadata.createdAt).getTime() - new Date(a.metadata.createdAt).getTime()
    );
  }

  // Execution operations
  async saveExecution(execution: ExecutionContext): Promise<void> {
    const key = `execution:${execution.executionId}`;
    await this.client.setex(key, 3600, JSON.stringify(execution)); // 1 hour TTL
  }

  async getExecution(executionId: string): Promise<ExecutionContext | null> {
    const key = `execution:${executionId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data as string) : null;
  }

  async updateExecutionStatus(
    executionId: string, 
    status: ExecutionContext['status'],
    updates: Partial<ExecutionContext> = {}
  ): Promise<void> {
    const execution = await this.getExecution(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const updatedExecution: ExecutionContext = {
      ...execution,
      ...updates,
      status,
      updatedAt: new Date().toISOString(),
    };

    await this.saveExecution(updatedExecution);
  }

  async deleteExecution(executionId: string): Promise<void> {
    const key = `execution:${executionId}`;
    await this.client.del(key);
  }

  async listExecutions(workflowId?: string): Promise<ExecutionContext[]> {
    const keys = await this.client.keys('execution:*');
    const executions: ExecutionContext[] = [];
    
    for (const key of keys) {
      const data = await this.client.get(key);
      if (data) {
        const execution = JSON.parse(data as string);
        if (!workflowId || execution.workflowId === workflowId) {
          executions.push(execution);
        }
      }
    }
    
    return executions.sort((a, b) => 
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  // Approval operations
  async saveApprovalRequest(approval: ApprovalRequest): Promise<void> {
    const key = `approval:${approval.executionId}`;
    await this.client.setex(key, 3600, JSON.stringify(approval)); // 1 hour TTL
  }

  async getApprovalRequest(executionId: string): Promise<ApprovalRequest | null> {
    const key = `approval:${executionId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data as string) : null;
  }

  async deleteApprovalRequest(executionId: string): Promise<void> {
    const key = `approval:${executionId}`;
    await this.client.del(key);
  }

  // Copilot session operations
  async saveCopilotSession(session: CopilotSession): Promise<void> {
    const key = `copilot:${session.id}`;
    await this.client.setex(key, 3600, JSON.stringify(session)); // 1 hour TTL
  }

  async getCopilotSession(sessionId: string): Promise<CopilotSession | null> {
    const key = `copilot:${sessionId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data as string) : null;
  }

  async deleteCopilotSession(sessionId: string): Promise<void> {
    const key = `copilot:${sessionId}`;
    await this.client.del(key);
  }

  // Utility operations
  async setWithTTL(key: string, value: any, ttlSeconds: number): Promise<void> {
    await this.client.setex(key, ttlSeconds, JSON.stringify(value));
  }

  async getWithTTL<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);
    return data ? JSON.parse(data as string) : null;
  }

  async deleteKey(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async getTTL(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  // Pub/Sub operations for real-time updates
  async publish(channel: string, message: any): Promise<void> {
    await this.client.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    // Note: This is a simplified implementation
    // For production, you'd want to use a proper Redis pub/sub client
    // or implement this with WebSockets/SSE
    console.log(`Subscribed to channel: ${channel}`);
  }

  // Cleanup operations
  async cleanupExpiredData(): Promise<void> {
    // This would typically be handled by Redis TTL, but we can add manual cleanup
    const patterns = ['workflow:*', 'execution:*', 'approval:*', 'copilot:*'];
    
    for (const pattern of patterns) {
      const keys = await this.client.keys(pattern);
      for (const key of keys) {
        const ttl = await this.client.ttl(key);
        if (ttl === -2) { // Key doesn't exist
          await this.client.del(key);
        }
      }
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const redisClient = new RedisClient();
