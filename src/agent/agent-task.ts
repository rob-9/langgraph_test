import { Task } from '../schema.js';

export class AgentTask {
  sessionId: string;
  taskId: number;
  agent: string;
  description: string;
  metadata?: Record<string, unknown> | null | undefined;

  response?: string;
  response_metadata?: Task | string;

  constructor(data: Record<string, any>, sessionId: string) {
    this.taskId = data.taskId;
    this.agent = data.agent;
    this.description = data.description;
    this.sessionId = sessionId;
  }
}
