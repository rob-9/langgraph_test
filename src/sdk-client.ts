import { Client } from '@langchain/langgraph-sdk';
import { SDKConfig, AgentTask } from './types';
import { SDK_CONFIG } from './config';

export class LangGraphSDKClient {
  private client: Client;
  private config: SDKConfig;

  constructor(config: SDKConfig = {}) {
    this.config = {
      ...SDK_CONFIG,
      ...config
    };

    this.client = new Client({
      apiUrl: this.config.apiUrl,
      apiKey: this.config.apiKey,
    });
  }

  // Thread management
  async createThread(metadata?: any) {
    if (!this.config.enablePersistence || !this.config.apiKey) {
      // Return mock thread for local development
      return {
        thread_id: `local_thread_${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: metadata || {},
        status: 'idle' as const,
        values: {},
        interrupts: {}
      };
    }

    return await this.client.threads.create({
      metadata
    });
  }

  async getThreadState(threadId: string) {
    if (!this.config.enablePersistence || !this.config.apiKey) {
      // Return mock state for local development
      return {
        values: {},
        next: [],
        checkpoint: {
          thread_id: threadId,
          checkpoint_ns: '',
          checkpoint_id: null,
          checkpoint_map: null
        },
        metadata: {},
        created_at: new Date().toISOString(),
        parent_checkpoint: null,
        tasks: []
      };
    }

    return await this.client.threads.getState(threadId);
  }

  async updateThreadState(threadId: string, values: any) {
    if (!this.config.enablePersistence || !this.config.apiKey) {
      console.log(`[Local] Updated thread ${threadId} with:`, values);
      return;
    }

    return await this.client.threads.updateState(threadId, values);
  }

  // Task management using Store
  async storeTask(agentId: string, task: AgentTask) {
    const namespace = ['agent_tasks', agentId];
    const key = task.id;
    
    if (!this.config.enablePersistence || !this.config.apiKey) {
      console.log(`[Local] Stored task for ${agentId}:`, task);
      return;
    }

    await this.client.store.putItem(
      namespace,
      key,
      {
        ...task,
        storedAt: new Date().toISOString()
      },
      { ttl: 60 * 24 } // 24 hours TTL
    );
  }

  async getAgentTasks(agentId: string): Promise<AgentTask[]> {
    if (!this.config.enablePersistence || !this.config.apiKey) {
      console.log(`[Local] Retrieved tasks for ${agentId}`);
      return [];
    }

    const namespace = ['agent_tasks', agentId];
    const response = await this.client.store.searchItems(
      namespace,
      { limit: 100 }
    );

    return response.items.map(item => ({
      id: item.key,
      ...item.value
    } as AgentTask));
  }

  async storeAgentResponse(taskId: string, agentId: string, response: string) {
    const namespace = ['agent_responses'];
    const key = taskId;
    
    if (!this.config.enablePersistence || !this.config.apiKey) {
      console.log(`[Local] Stored response for task ${taskId} from ${agentId}:`, response);
      return;
    }

    await this.client.store.putItem(
      namespace,
      key,
      {
        agentId,
        response,
        timestamp: new Date().toISOString()
      },
      { ttl: 60 * 24 }
    );
  }

  async getTaskResponse(taskId: string): Promise<string | null> {
    if (!this.config.enablePersistence || !this.config.apiKey) {
      return null;
    }

    try {
      const item = await this.client.store.getItem(['agent_responses'], taskId);
      return item?.value?.response || null;
    } catch {
      return null;
    }
  }

  // Agent coordination using Store
  async storeAgentMessage(message: any) {
    const namespace = ['agent_messages'];
    const key = message.id;
    
    if (!this.config.enablePersistence || !this.config.apiKey) {
      console.log(`[Local] Stored message:`, message);
      return;
    }

    await this.client.store.putItem(
      namespace,
      key,
      message,
      { ttl: 60 * 24 }
    );
  }

  async getAgentMessages(agentId?: string): Promise<any[]> {
    if (!this.config.enablePersistence || !this.config.apiKey) {
      return [];
    }

    const namespace = ['agent_messages'];
    const response = await this.client.store.searchItems(
      namespace,
      { limit: 100 }
    );

    let messages = response.items.map(item => item.value);
    
    if (agentId) {
      messages = messages.filter(msg => msg.to === agentId || msg.from === agentId);
    }

    return messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  // Cleanup old data
  async cleanupExpiredData() {
    if (!this.config.enablePersistence || !this.config.apiKey) {
      return;
    }

    const namespaces = [
      ['agent_tasks'],
      ['agent_responses'], 
      ['agent_messages']
    ];

    for (const namespace of namespaces) {
      try {
        const response = await this.client.store.searchItems(namespace, { limit: 1000 });
        const expiredItems = response.items.filter(item => {
          const createdAt = new Date(item.createdAt);
          const now = new Date();
          const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
          return hoursDiff > 24; // Delete items older than 24 hours
        });

        for (const item of expiredItems) {
          await this.client.store.deleteItem(namespace, item.key);
        }
      } catch (error) {
        console.warn(`Failed to cleanup namespace ${namespace.join('/')}:`, error);
      }
    }
  }
}

// Singleton instance
let sdkClientInstance: LangGraphSDKClient | null = null;

export function getSDKClient(config?: SDKConfig): LangGraphSDKClient {
  if (!sdkClientInstance) {
    sdkClientInstance = new LangGraphSDKClient(config);
  }
  return sdkClientInstance;
}