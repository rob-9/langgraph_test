import { HumanMessage, AIMessage } from '@langchain/core/messages';
import type { ThreadTask, Thread, ThreadState, Run, Interrupt } from '@langchain/langgraph-sdk';

// Re-export SDK types for convenience
export type { ThreadTask, Thread, ThreadState, Run, Interrupt };

// Enhanced agent task with SDK ThreadTask as base
export interface AgentTask extends ThreadTask {
  assignedAgent?: string;
  dependencies?: string[];
  description?: string;
  startTime?: Date;
  endTime?: Date;
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

// SDK Client configuration
export interface SDKConfig {
  apiUrl?: string;
  apiKey?: string;
}