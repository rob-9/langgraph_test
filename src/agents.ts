import { AIMessage } from '@langchain/core/messages';
import { AgentMessage, AgentResponse, AgentTask } from './types';
import { AGENT_CONFIGS, SYSTEM_CONFIG } from './config';
import { PlanAnnotation } from './state';
import { getSDKClient, LangGraphSDKClient } from './sdk-client';

// Enhanced agent communication using SDK
class SDKMessageBus {
  private static instance: SDKMessageBus;
  private sdkClient: LangGraphSDKClient;

  static getInstance(): SDKMessageBus {
    if (!SDKMessageBus.instance) {
      SDKMessageBus.instance = new SDKMessageBus();
    }
    return SDKMessageBus.instance;
  }

  constructor() {
    this.sdkClient = getSDKClient();
  }

  async sendMessage(message: Omit<AgentMessage, 'id' | 'timestamp'>): Promise<string> {
    const fullMessage: AgentMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...message
    };
    
    // Store message in SDK store
    await this.sdkClient.storeAgentMessage(fullMessage);
    
    // Process agent response
    const response = await this.processAgentResponse(fullMessage);
    
    // Store response
    if (fullMessage.taskId) {
      await this.sdkClient.storeAgentResponse(fullMessage.taskId, fullMessage.to, response);
    }
    
    return response;
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
          const randomValue = Math.floor(Math.random() * 100000) + 50000;
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

  async getMessageHistory(agentId?: string): Promise<AgentMessage[]> {
    return await this.sdkClient.getAgentMessages(agentId);
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
  
  const sdkClient = getSDKClient();
  const messageBus = SDKMessageBus.getInstance();
  
  // Create AgentTask using SDK ThreadTask structure
  const task: AgentTask = {
    id: taskId || `task_${Date.now()}_${agentId}`,
    name: `${agentId}_task`,
    assignedAgent: agentId,
    description: taskDescription,
    startTime: new Date(),
    result: undefined,
    error: null,
    interrupts: [],
    checkpoint: null,
    state: null
  };
  
  // Store task in SDK
  await sdkClient.storeTask(agentId, task);
  
  // Send message to agent
  const response = await messageBus.sendMessage({
    from: 'zAI',
    to: agentId,
    content: taskDescription,
    taskId: task.id,
    messageType: 'task_delegation'
  });
  
  // Update task with completion
  task.result = response;
  task.endTime = new Date();
  await sdkClient.storeTask(agentId, task);
  
  return response;
}

export async function coordinateAgents(state: typeof PlanAnnotation.State) {
  const currentStepIndex = state.currentStep || 0;
  const currentStepText = state.plan[currentStepIndex];
  const sdkClient = getSDKClient();
  
  // Initialize thread if not exists
  let threadId = state.threadId;
  if (!threadId) {
    const thread = await sdkClient.createThread({
      step: currentStepIndex,
      plan: state.plan
    });
    threadId = thread.thread_id;
  }
  
  // Determine which agent should handle this task
  const responsibleAgent = determineResponsibleAgent(currentStepText);
  
  // Create and delegate task
  const taskId = `task_${currentStepIndex}_${Date.now()}`;
  const response = await delegateTask(responsibleAgent, currentStepText, taskId);
  
  // Create enhanced AgentTask
  const agentTask: AgentTask = {
    id: taskId,
    name: `step_${currentStepIndex}_${responsibleAgent}`,
    assignedAgent: responsibleAgent,
    description: currentStepText,
    result: response,
    error: null,
    interrupts: [],
    checkpoint: null,
    state: null,
    startTime: new Date(),
    endTime: new Date()
  };
  
  const agentMessage: AgentMessage = {
    id: `msg_${Date.now()}`,
    from: 'zAI',
    to: responsibleAgent,
    content: currentStepText,
    taskId,
    timestamp: new Date(),
    messageType: 'task_delegation'
  };
  
  // Update thread state
  await sdkClient.updateThreadState(threadId, {
    currentStep: currentStepIndex + 1,
    lastCompletedTask: agentTask
  });
  
  return {
    threadId,
    currentStep: currentStepIndex + 1,
    currentAgent: responsibleAgent,
    tasks: [agentTask],
    agentMessages: [agentMessage],
    agentResponses: { [taskId]: response },
    taskCheckpoints: { [taskId]: { completed: true, timestamp: new Date() } },
    messages: [new AIMessage(`Step ${currentStepIndex + 1} - Delegated to ${AGENT_CONFIGS[responsibleAgent].name}: ${response}`)]
  };
}