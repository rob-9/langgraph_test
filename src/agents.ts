import { AIMessage } from '@langchain/core/messages';
import { AgentMessage, AgentResponse, Task } from './types';
import { AGENT_CONFIGS, SYSTEM_CONFIG } from './config';
import { PlanAnnotation } from './state';
import { executeStep } from './nodes';

// Message passing system for agent communication
class MessageBus {
  private static instance: MessageBus;
  private messages: AgentMessage[] = [];

  static getInstance(): MessageBus {
    if (!MessageBus.instance) {
      MessageBus.instance = new MessageBus();
    }
    return MessageBus.instance;
  }

  async sendMessage(message: Omit<AgentMessage, 'id' | 'timestamp'>): Promise<string> {
    const fullMessage: AgentMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...message
    };
    
    this.messages.push(fullMessage);
    // Mock agent response - all agents respond with "Hi" for now
    return await this.processAgentResponse(fullMessage);
  }

  private async processAgentResponse(message: AgentMessage): Promise<string> {
    const targetAgent = AGENT_CONFIGS[message.to];
    
    if (!targetAgent) {
      return `Error: Agent ${message.to} not found`;
    }

    // Agent-specific responses
    switch (message.to) {
      case 'HR':
        // Check if this looks like a function call that should return data
        if (/(get|fetch|find|query|retrieve|salary|employee|data)/i.test(message.content)) {
          const randomValue = Math.floor(Math.random() * 100000) + 50000; // Random salary between 50k-150k
          return `HR Agent: GraphQL query executed. Result: ${randomValue}`;
        }
        return `HR Agent: Hi from ${targetAgent.name}`;
        
      case 'FPA':
        // Only respond to financial-related queries
        if (/(financial|budget|revenue|profit|cost|expense|analysis|report|metric)/i.test(message.content)) {
          return `FPA Agent: Financial analysis completed - Hi from ${targetAgent.name}`;
        }
        return `FPA Agent: This task is outside my financial domain - Hi from ${targetAgent.name}`;
        
      default:
        return `Hi from ${targetAgent.name}`;
    }
  }

  getMessageHistory(): AgentMessage[] {
    return [...this.messages];
  }
}

export function determineResponsibleAgent(taskDescription: string): string {
  // First, check if agent is explicitly assigned in the step
  const agentMatch = taskDescription.match(/\[(\w+)\]\s*(.+)/);
  if (agentMatch && AGENT_CONFIGS[agentMatch[1]]) {
    return agentMatch[1];
  }
  
  // Fallback to keyword-based assignment
  const task = taskDescription.toLowerCase();
  
  // HR-related keywords
  if (/(salary|employee|hiring|hr|staff|personnel|performance|review|amanda|john|employee)/i.test(task)) {
    return 'HR';
  }
  
  // Financial/Process keywords  
  if (/(financial|budget|cost|expense|process|automation|fpa|report|analysis)/i.test(task)) {
    return 'FPA';
  }
  
  // Default to zAI for complex coordination tasks
  return 'zAI';
}

export async function delegateTask(agentId: string, taskDescription: string, taskId?: string): Promise<string> {
  const agent = AGENT_CONFIGS[agentId];
  
  if (!agent) {
    return `Error: Agent ${agentId} not found`;
  }
  
  // Delegating task to agent
  
  const messageBus = MessageBus.getInstance();
  
  // Send message to agent
  const response = await messageBus.sendMessage({
    from: 'zAI',
    to: agentId,
    content: taskDescription,
    taskId: taskId,
    messageType: 'task_delegation'
  });
  
  return response;
}

export async function coordinateAgents(state: typeof PlanAnnotation.State) {
  const currentStepIndex = state.currentStep || 0;
  const currentStepText = state.plan[currentStepIndex];
  
  // Coordinating step execution
  
  // Determine which agent should handle this task
  const responsibleAgent = determineResponsibleAgent(currentStepText);
  
  // Always delegate through message passing system
  const taskId = `task_${currentStepIndex}_${Date.now()}`;
  const response = await delegateTask(responsibleAgent, currentStepText, taskId);
  
  const agentMessage: AgentMessage = {
    id: `msg_${Date.now()}`,
    from: 'zAI',
    to: responsibleAgent,
    content: currentStepText,
    taskId,
    timestamp: new Date(),
    messageType: 'task_delegation'
  };
  
  return {
    currentStep: currentStepIndex + 1,
    currentAgent: responsibleAgent,
    agentMessages: [agentMessage],
    agentResponses: { [taskId]: response },
    messages: [new AIMessage(`Step ${currentStepIndex + 1} - Delegated to ${AGENT_CONFIGS[responsibleAgent].name}: ${response}`)]
  };
}