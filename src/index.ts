import 'dotenv/config';
import { EventEmitter } from 'events';
EventEmitter.defaultMaxListeners = 50;
import { HumanMessage } from '@langchain/core/messages';
import { StateGraph } from '@langchain/langgraph';
import { PlanAnnotation } from './state';
import { SYSTEM_CONFIG, AGENT_CONFIGS } from './config';
import { 
  classifyQuery, 
  simpleResponse, 
  directAgentExecution,
  createPlan, 
  executeStep, 
  stepApproval, 
  stepClarification, 
  stepContext,
  aggregateResults,
  shouldContinue 
} from './nodes';
import { coordinateAgents } from './agents';
import { getSDKClient } from './sdk-client';

/*
Configuration-Driven Multi-Agent Workflow:

SYSTEM_CONFIG:
- use_pae: true (global PAE setting) 
- enable_hitl: false (HITL disabled for testing)

AGENTS:
- zAI: Orchestrator (use_pae=true, isLeafAgent=false)
- HR:  Leaf agent (use_pae=false, isLeafAgent=true) - Direct execution only  
- FPA: Leaf agent (use_pae=true, isLeafAgent=true) - Full PAE workflow

WORKFLOW GRAPH:

                    __start__
                        |
                        v
                  ┌─────────────┐
                  │   classify  │ (skipped for HR: use_pae=false)
                  └─────┬───────┘
                        │
                 shouldContinue()
                   /         \
                 v             v
           ┌─────────┐  ┌──────────┐
           │  simple │  │createPlan│ (with agent assignments)
           └────┬────┘  └────┬─────┘
                │            │
                v      shouldContinue()
             __end__         │
                             v
                    ┌────────────────┐◄─┐
                    │coordinateAgents│  │ (message passing)
                    └────────┬───────┘  │
                             │          │
                      (agent delegation) │
                        /    |    \     │
                      v      v      v   │
              ┌──────────┐ ┌─────┐ ┌─────┐│
              │zAI (Top) │ │ HR  │ │ FPA ││
              │Planner   │ │Leaf │ │Leaf ││
              └──────────┘ └─────┘ └─────┘│
                             │          │
                      All respond "Hi"   │
                             │          │
                             v          │
                      shouldContinue()  │
                             │          │
                    (HITL disabled)     │
                             │          │
                             └──────────┘
                             │
                             v
                      shouldContinue()
                        /         \
                      v             v
              ┌─────────────────┐   (next step)
              │ aggregateResults│
              │     (zAI)       │
              └─────┬───────────┘
                    │
                    v
                 __end__

FINAL AGGREGATION:
- zAI synthesizes all agent responses
- Creates comprehensive final answer
- Acknowledges contributing agents

MESSAGE PASSING: 
- MessageBus singleton handles agent communication
- Future-compatible with A2A/MCP integration
- All agents currently mock respond with "Hi"
*/

const workflow = new StateGraph(PlanAnnotation)
  .addNode('classify', classifyQuery)
  .addNode('simple', simpleResponse)
  .addNode('directAgentExecution', directAgentExecution)
  .addNode('createPlan', createPlan)
  .addNode('executeStep', executeStep)
  .addNode('coordinateAgents', coordinateAgents)
  .addNode('stepApproval', stepApproval)
  .addNode('stepClarification', stepClarification)
  .addNode('stepContext', stepContext)
  .addNode('aggregateResults', aggregateResults)

  .addEdge('__start__', 'classify')
  .addConditionalEdges('classify', shouldContinue)
  .addConditionalEdges('createPlan', shouldContinue)
  .addConditionalEdges('executeStep', shouldContinue)
  .addConditionalEdges('coordinateAgents', shouldContinue)
  .addConditionalEdges('stepApproval', shouldContinue)
  .addConditionalEdges('stepClarification', shouldContinue)
  .addConditionalEdges('stepContext', shouldContinue)
  .addEdge('simple', '__end__')
  .addEdge('directAgentExecution', '__end__')
  .addEdge('aggregateResults', '__end__');

const app = workflow.compile();

async function runAgent(userInput: string) {
  console.log(`\n=== Query: ${userInput} ===`);
  
  // Initialize SDK client for enhanced task tracking
  const sdkClient = getSDKClient();
  
  // Create thread for persistent task tracking
  const thread = await sdkClient.createThread({
    query: userInput,
    startTime: new Date().toISOString()
  });
  
  const initialState = {
    messages: [new HumanMessage(userInput)],
    isComplex: false,
    plan: [],
    currentAgent: 'zAI',
    agentMessages: [],
    delegatedTasks: {},
    agentResponses: {},
    tasks: [],
    threadId: thread.thread_id,
    taskCheckpoints: {},
    taskInterrupts: {}
  };
  
  const stream = await app.stream(initialState);
  let finalResult;
  
  for await (const step of stream) {
    const nodeName = Object.keys(step)[0];
    const nodeResult = step[nodeName];
    finalResult = nodeResult;
    
    // Enhanced logging with task tracking information
    if (nodeName === 'createPlan' || nodeName === 'aggregateResults' || nodeName === 'simple' || nodeName === 'directAgentExecution') {
      if (nodeResult.messages && nodeResult.messages.length > 0) {
        const lastMessage = nodeResult.messages[nodeResult.messages.length - 1];
        console.log(`${lastMessage.content}`);
      }
    }
    
    // Show agent task responses with enhanced tracking
    if (nodeName === 'coordinateAgents') {
      if (nodeResult.messages && nodeResult.messages.length > 0) {
        const lastMessage = nodeResult.messages[nodeResult.messages.length - 1];
        console.log(`${lastMessage.content}`);
      }
      
      // Show task execution details
      if (nodeResult.tasks && nodeResult.tasks.length > 0) {
        const task = nodeResult.tasks[0];
        console.log(`  └─ Task: ${task.id} (${task.assignedAgent}) - ${task.result ? 'Completed' : 'In Progress'}`);
        
        if (task.startTime && task.endTime) {
          const duration = new Date(task.endTime).getTime() - new Date(task.startTime).getTime();
          console.log(`  └─ Duration: ${duration}ms`);
        }
      }
    }
  }
  
  return finalResult?.messages?.[finalResult.messages.length - 1]?.content || 'No response';
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: Please set your ANTHROPIC_API_KEY in the .env file');
    process.exit(1);
  }
  
  console.log('Agents: zAI (orchestrator), HR (leaf), FPA (leaf)');
  
  // Initialize SDK client and cleanup old data
  const sdkClient = getSDKClient();
  await sdkClient.cleanupExpiredData();
  
  try {
    await runAgent('Hello! Can you tell me what you are?');
    await runAgent('Hello. please get Amanda salary.');
    await runAgent('Analyze our quarterly budget and create a financial report');
    
    // Optional: Show task tracking summary
    console.log('\nTask Tracking Summary:');
    const hrTasks = await sdkClient.getAgentTasks('HR');
    const fpaTasks = await sdkClient.getAgentTasks('FPA');
    const zaiTasks = await sdkClient.getAgentTasks('zAI');
    
    console.log(`  HR Agent: ${hrTasks.length} tasks completed`);
    console.log(`  FPA Agent: ${fpaTasks.length} tasks completed`);
    console.log(`  zAI Agent: ${zaiTasks.length} tasks completed`);
    
  } catch (error) {
    console.error('Error running agent:', error);
  }
}

if (require.main === module) {
  main();
}