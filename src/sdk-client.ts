import { AgentTask } from './types';

export class LangGraphSDKClient {
  private tasks: Map<string, AgentTask[]> = new Map();

  constructor() {
  }

  // Task management using Store
  async storeTask(agentId: string, task: AgentTask) {
    console.log(`[Local] Stored task for ${agentId}:`, task);
    
    if (!this.tasks.has(agentId)) {
      this.tasks.set(agentId, []);
    }
    
    const agentTasks = this.tasks.get(agentId)!;
    const existingIndex = agentTasks.findIndex(t => t.id === task.id);
    
    if (existingIndex >= 0) {
      agentTasks[existingIndex] = task;
    } else {
      agentTasks.push(task);
    }
  }

  async getAgentTasks(agentId: string): Promise<AgentTask[]> {
    const tasks = this.tasks.get(agentId) || [];
    console.log(`[Local] Retrieved ${tasks.length} tasks for ${agentId}`);
    return tasks;
  }

  async storeAgentResponse(taskId: string, agentId: string, response: string) {
    console.log(`[Local] Stored response for task ${taskId} from ${agentId}:`, response);
  }

  async getTaskResponse(): Promise<string | null> {
    return null;
  }

  // Agent coordination using Store
  async storeAgentMessage(message: any) {
    console.log(`[Local] Stored message:`, message);
  }

  async getAgentMessages(): Promise<any[]> {
    return [];
  }

  clearTasks() {
    this.tasks.clear();
  }

}

let sdkClientInstance: LangGraphSDKClient | null = null;

export function getSDKClient(): LangGraphSDKClient {
  if (!sdkClientInstance) {
    sdkClientInstance = new LangGraphSDKClient();
  }
  return sdkClientInstance;
}