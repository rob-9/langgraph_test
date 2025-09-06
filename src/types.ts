import { HumanMessage, AIMessage } from '@langchain/core/messages';

export interface Task {
  id: string;
  description: string;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  startTime?: Date;
  endTime?: Date;
  assignedAgent?: string; // Agent assigned to execute this task
}

export interface PlanState {
  messages: (HumanMessage | AIMessage)[];
  isComplex: boolean;
  tasks: Task[];
  allTasksCompleted: boolean;
  executionResults: string[];
}

export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  taskId?: string;
  timestamp: Date;
  messageType: 'task_delegation' | 'response' | 'coordination';
}

export interface AgentResponse {
  agentId: string;
  taskId: string;
  response: string;
  success: boolean;
  timestamp: Date;
}