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
  stepApproval, 
  stepClarification, 
  stepContext,
  aggregateResults,
  shouldContinue 
} from './nodes';
import { coordinateAgents } from './agents';
import { getSDKClient } from './sdk-client';

/*
Configuration-Driven Multi-Agent Workflow with LangGraph SDK Integration:

SYSTEM_CONFIG:
- use_pae: true (global PAE setting) 
- enable_hitl: false (HITL disabled for testing)

AGENTS:
- zAI: Orchestrator (coordination & aggregation)
- HR:  Employee/salary data (GraphQL schema access)
- FPA: Financial analysis & reporting

WORKFLOW GRAPH:

                    __start__
                        |
                        v
                  ┌─────────────┐
                  │   classify  │ (Simple vs Complex)
                  └─────┬───────┘
                        │
                 shouldContinue()
                   /         \
                 v             v
           ┌─────────┐    ┌──────────┐
           │  simple │    │shouldContinue│
           └────┬────┘    └────┬─────┘
                │              │
                v         HR queries? / Plan needed?
             __end__           |              |
                            v              v
                  ┌─────────────────┐  ┌──────────┐
                  │directAgentExec  │  │createPlan│
                  │(HR bypass PAE)  │  │(steps+agents)│
                  └────┬────────────┘  └────┬─────┘
                       │                    │
                       v             shouldContinue()
                    __end__                │
                                          v
                                shouldContinue()◄─┐
                                 (HITL enabled?)  │
                                    /   |   \     │
                     needsApproval?/    |    \waitingForHuman?
                                 v      |      v  │
                          ┌─────────────┐  ┌──────────────┐│
                          │stepApproval │  │stepClarification││
                          │(approve/    │  │(continue/    ││
                          │modify/skip) │  │replan)       ││
                          └─────┬───────┘  └──────┬───────┘│
                                │                 │        │
                                └────┐    ┌───────┘        │
                                     │    │                │
                              needsContext?                │
                                     │    │                │
                                     v    v                │
                              ┌─────────────────┐          │
                              │   stepContext   │          │
                              │(collect context)│          │
                              └─────┬───────────┘          │
                                    │                      │
                             (all HITL resolved)           │
                                    │                      │
                                    v                      │
                             ┌────────────────┐            │
                             │coordinateAgents│            │
                             └────────┬───────┘            │
                                      │                    │
                               (task delegation)           │
                                 /    |    \               │
                               v      v      v             │
                       ┌──────────┐ ┌─────┐ ┌─────┐        │
                       │   zAI    │ │ HR  │ │ FPA │        │
                       │(coord)   │ │Data │ │Fin  │        │
                       └──────────┘ └─────┘ └─────┘        │
                                      │                    │
                               Agent responses             │
                                      │                    │
                                      v                    │
                               shouldContinue()            │
                                (next step?)               │
                                      │                    │
                                      └────────────────────┘
                                      │
                           (all steps complete)
                                      │
                                      v
                             ┌─────────────────┐
                             │ aggregateResults│
                             │  (zAI synthesis)│
                             └─────┬───────────┘
                                   │
                                   v
                                __end__

*/

const workflow = new StateGraph(PlanAnnotation)
  .addNode('classify', classifyQuery)
  .addNode('simple', simpleResponse)
  .addNode('directAgentExecution', directAgentExecution)
  .addNode('createPlan', createPlan)
  .addNode('coordinateAgents', coordinateAgents)
  .addNode('stepApproval', stepApproval)
  .addNode('stepClarification', stepClarification)
  .addNode('stepContext', stepContext)
  .addNode('aggregateResults', aggregateResults)

  .addEdge('__start__', 'classify')
  .addConditionalEdges('classify', shouldContinue)
  .addConditionalEdges('createPlan', shouldContinue)
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
  
  const initialState = {
    messages: [new HumanMessage(userInput)],
    isComplex: false,
    plan: [],
    currentAgent: 'zAI',
    agentMessages: [],
    delegatedTasks: {},
    agentResponses: {},
    tasks: [],
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
  
  try {
    const sdkClient = getSDKClient();
    
    // Clear and run first query
    sdkClient.clearTasks();
    await runAgent('Hello! Can you tell me what you are?');
    await showTaskSummary();
    
    // Clear and run second query  
    sdkClient.clearTasks();
    await runAgent('Hello. please get Amanda salary.');
    await showTaskSummary();
    
    // Clear and run third query
    sdkClient.clearTasks();
    await runAgent('Analyze our quarterly budget and create a financial report');
    await showTaskSummary();
    
  } catch (error) {
    console.error('Error running agent:', error);
  }
}

async function showTaskSummary() {
  const sdkClient = getSDKClient();
  console.log('\nTask Tracking Summary:');
  const hrTasks = await sdkClient.getAgentTasks('HR');
  const fpaTasks = await sdkClient.getAgentTasks('FPA');
  const zaiTasks = await sdkClient.getAgentTasks('zAI');
  
  console.log(`  HR Agent: ${hrTasks.length} tasks completed`);
  console.log(`  FPA Agent: ${fpaTasks.length} tasks completed`);
  console.log(`  zAI Agent: ${zaiTasks.length} tasks completed`);
}

if (require.main === module) {
  main();
}