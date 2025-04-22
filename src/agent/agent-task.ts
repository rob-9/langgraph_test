import { Task } from '../schema.js';

export class AgentTask {
  taskId: number;
  agent: string;
  description: string;
  response?: string;
  response_metadata?: Task | string;

  constructor(data: Record<string, any>) {
    this.taskId = data.taskId;
    this.agent = data.agent;
    this.description = data.description;
  }
}
