import 'dotenv/config';
import { EventEmitter } from 'events';
EventEmitter.defaultMaxListeners = 50;
import { ChatAnthropic } from '@langchain/anthropic';
import { StateGraph, MessagesAnnotation, Annotation } from '@langchain/langgraph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';


interface Task {
  id: string;
  description: string;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  startTime?: Date;
  endTime?: Date;
}
interface PlanState {
  messages: (HumanMessage | AIMessage)[];
  isComplex: boolean;
  tasks: Task[];
  allTasksCompleted: boolean;
  executionResults: string[];
}

const PlanAnnotation = Annotation.Root({
  messages: Annotation<(HumanMessage | AIMessage)[]>({
    reducer: (prev = [], next = []) => prev.concat(next)
  }),

  isComplex: Annotation<boolean>({
    reducer: (x, y) => y ?? x
  }),
  
  plan: Annotation<string[]>({
    reducer: (prev = [], next = []) => next.length > 0 ? next : prev
  }),
  
  currentStep: Annotation<number>({
    reducer: (x, y) => y ?? x
  }),
  
  waitingForHuman: Annotation<boolean>({
    reducer: (x, y) => y ?? x
  }),
  
  humanInput: Annotation<string>({
    reducer: (x, y) => y ?? x
  }),
  
  needsApproval: Annotation<boolean>({
    reducer: (x, y) => y ?? x
  }),
  
  needsContext: Annotation<boolean>({
    reducer: (x, y) => y ?? x
  }),
  
  confidenceScore: Annotation<number>({
    reducer: (x, y) => y ?? x
  }),
  
  pendingApproval: Annotation<any>({
    reducer: (x, y) => y ?? x
  }),
  
  approvedSteps: Annotation<number[]>({
    reducer: (prev = [], next = []) => prev.concat(next)
  }),
  
  tasks: Annotation<Task[]>({
    reducer: (prev = [], next = []) => {
      if (next.length === 0) return prev;
      const merged = [...prev];
      next.forEach(newTask => {
        const existingIndex = merged.findIndex(t => t.id === newTask.id);
        if (existingIndex >= 0) {
          merged[existingIndex] = newTask;
        } else {
          merged.push(newTask);
        }
      });
      return merged;
    }
  }),
  
  allTasksCompleted: Annotation<boolean>({
    reducer: (x, y) => y ?? x
  }),
  
  executionResults: Annotation<string[]>({
    reducer: (prev = [], next = []) => prev.concat(next)
  })
});

const model = new ChatAnthropic({
  model: 'claude-3-7-sonnet-20250219',
  apiKey: process.env.ANTHROPIC_API_KEY,
  temperature: 0.7,
});

async function classifyQuery(state: typeof PlanAnnotation.State) {
  const lastMessage = state.messages[state.messages.length - 1];
  
  const classificationPrompt = new HumanMessage(`
Analyze this user query and determine if it's SIMPLE or COMPLEX:

Query: "${lastMessage.content}"

A SIMPLE query is one that can be answered directly with existing knowledge (greetings, definitions, basic facts) that does not need a workflow to answer. 
A COMPLEX query requires multiple steps, research, planning, or problem-solving to generate a satisfactory response.

Respond with only "SIMPLE" or "COMPLEX":
`);

  const response = await model.invoke([classificationPrompt]);
  const isComplex = response.content.toString().trim().toUpperCase() === 'COMPLEX';
  
  console.log(`Query classification: ${isComplex ? 'COMPLEX' : 'SIMPLE'}`);
  
  return {
    isComplex
  };
}

async function simpleResponse(state: typeof PlanAnnotation.State) {
  console.log('Handling simple query directly');
  
  const response = await model.invoke(state.messages);
  
  return {
    messages: [response]
  };
}

async function createPlan(state: typeof PlanAnnotation.State) {
  const lastMessage = state.messages[state.messages.length - 1];
  
  const planningPrompt = new HumanMessage(`
Create a concise, actionable plan to complete this task:

Query: "${lastMessage.content}"

Provide 2-4 specific, executable steps that directly accomplish the task.
Focus on concrete actions, not explanations or theory.

Format your response as:
1. [Step 1]
2. [Step 2]
3. [Step 3]

Maximum 4 steps. Each step should produce a concrete deliverable.
`);

  const response = await model.invoke([planningPrompt]);
  const planText = response.content.toString();
  
  const steps = planText.split('\n')
    .filter(line => /^\d+\./.test(line.trim()))
    .map(step => step.replace(/^\d+\.\s*/, '').trim());
  
  console.log('Generated plan with', steps.length, 'steps');
  steps.forEach((step, i) => console.log(`  ${i + 1}. ${step}`));
  
  return {
    plan: steps,
    currentStep: 0,
    messages: [new AIMessage(`I'll handle this complex query step by step:\n\n${steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}\n\nLet me start working through these steps...`)]
  };
}

function requiresApproval(stepText: string): { required: boolean; reason: string } {
  const dbKeywords = /(create|insert|update|delete|drop|alter|modify|remove)/i;
  const hasDbOperation = dbKeywords.test(stepText);
  
  if (hasDbOperation) return { required: true, reason: "db-change" };
  return { required: false, reason: "" };
}

async function executeStep(state: typeof PlanAnnotation.State) {
  const currentStepIndex = state.currentStep || 0;
  const currentStepText = state.plan[currentStepIndex];
  
  console.log(`Executing step ${currentStepIndex + 1}: ${currentStepText}`);
  
  const approval = requiresApproval(currentStepText);
  const isApproved = (state.approvedSteps || []).includes(currentStepIndex);
  
  if (approval.required && !isApproved) {
    return {
      needsApproval: true,
      pendingApproval: {
        stepIndex: currentStepIndex,
        stepText: currentStepText,
        reason: approval.reason
      }
    };
  }
  
  const executionPrompt = new HumanMessage(`
Execute this specific step from the plan:

Step: "${currentStepText}"

Previous context from earlier steps:
${state.messages.slice(-3).map(m => m.content).join('\n\n')}

Rate your confidence (0-100) in completing this step successfully, then provide your response.
Format: "Confidence: [score]\n\n[your response]"
`);

  const response = await model.invoke([executionPrompt]);
  const responseText = response.content.toString();
  
  const confidenceMatch = responseText.match(/Confidence:\s*(\d+)/i);
  const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 100;
  
  if (confidence < 70) {
    return {
      waitingForHuman: true,
      confidenceScore: confidence,
      messages: [new AIMessage(`Step ${currentStepIndex + 1} - Low confidence (${confidence}%): ${responseText}`)]
    };
  }
  
  return {
    currentStep: currentStepIndex + 1,
    confidenceScore: confidence,
    messages: [new AIMessage(`Step ${currentStepIndex + 1} completed: ${responseText}`)]
  };
}

async function stepApproval(state: typeof PlanAnnotation.State) {
  const { stepIndex, stepText, reason } = state.pendingApproval;
  
  console.log(`\nAPPROVAL REQUIRED (${reason})`);
  console.log(`Step ${stepIndex + 1}: ${stepText}`);
  console.log(`Options: [a]pprove, [m]odify, [s]kip, [e]dit remaining plan`);
  
  // In real implementation, this would wait for actual huma1n input
  // For now, simulate approval
  const humanDecision: string = 'a'; // simulate approve
  
  switch (humanDecision) {
    case 'a': // approve  
      return {
        needsApproval: false,
        pendingApproval: null,
        approvedSteps: [stepIndex]
      };
    case 'm': // modify step
      const modifiedStep = stepText; // In real app, get from human input
      const updatedPlan = [...state.plan];
      updatedPlan[stepIndex] = modifiedStep;
      return {
        needsApproval: false,
        pendingApproval: null,
        plan: updatedPlan
      };
    case 's': // skip step
      return {
        needsApproval: false,
        pendingApproval: null,
        currentStep: (state.currentStep || 0) + 1
      };
    case 'e': // edit remaining plan
      return {
        needsApproval: false,
        pendingApproval: null,
        waitingForHuman: true
      };
    default:
      return { needsApproval: false, pendingApproval: null };
  }
}

async function stepClarification(state: typeof PlanAnnotation.State) {
  console.log(`\nCLARIFICATION NEEDED`);
  console.log(`Confidence: ${state.confidenceScore}%`);
  console.log(`Current situation requires human guidance.`);
  console.log(`Options: [c]ontinue anyway, [p]rovide guidance, [r]eplan remaining steps`);
  
  const humanDecision: string = 'c';
  
  if (humanDecision === 'c') {
    return {
      waitingForHuman: false,
      confidenceScore: 100
    };
  } else if (humanDecision === 'p') {
    const guidance = "Proceed with the suggested approach";
    return {
      waitingForHuman: false,
      humanInput: guidance,
      confidenceScore: 100
    };
  } else if (humanDecision === 'r') {
    return {
      waitingForHuman: false,
      needsContext: true
    };
  }
  return { waitingForHuman: false };
}

async function stepContext(state: typeof PlanAnnotation.State) {
  console.log(`\nCONTEXT COLLECTION`);
  console.log(`Additional information needed to proceed.`);
  
  const additionalContext = "User provided additional context here";
  
  return {
    needsContext: false,
    humanInput: additionalContext,
    messages: [new AIMessage(`Context added: ${additionalContext}`)]
  };
}

function shouldContinue(state: typeof PlanAnnotation.State) {
  if (!state.isComplex) {
    return 'simple';
  }
  if (!state.plan || state.plan.length === 0) {
    return 'createPlan';
  }
  if (state.needsApproval) {
    return 'stepApproval';
  }
  if (state.waitingForHuman) {
    return 'stepClarification';
  }
  if (state.needsContext) {
    return 'stepContext';
  }
  const currentStep = state.currentStep || 0;
  if (currentStep < state.plan.length) {
    return 'executeStep';
  }
  return 'end';
}

// check the config variable

// true - run classify llm
// false - straight to execute with HITL or not


// 3 agents - zAI and two other leaf agents - HR and FPA
// zAI: should be able to create a plan and execute this plan - should specify which agents should do which tasks
// - have hardcoded list of agents and their capabilities
// - send message to one or both agents to tell them to do something
// - these agents will say Hi back. no other functionality


/*
                    __start__
                        |
                        v
                  ┌─────────────┐
                  │   classify  │
                  └─────┬───────┘
                        │
                 shouldContinue()
                   /         \
                 v             v
           ┌─────────┐  ┌──────────┐
           │  simple │  │createPlan│
           └────┬────┘  └────┬─────┘
                │            │
                v      shouldContinue()
             __end__         │
                             v
                       ┌─────────────┐◄─┐
                       │ executeStep │  │
                       └─────┬───────┘  │
                             │          │
                      (needs approval?) │
                        /         \     │
                      v             v   │
              ┌─────────────┐     │     │
              │stepApproval │     │     │
              └─────┬───────┘     │     │
                    │             │     │
                    v             │     │
             (needs clarification?)     │
                  /         \           │
                v             v         │
        ┌─────────────────┐   │         │
        │stepClarification│   │         │
        └─────┬───────────┘   │         │
              │               │         │
              v               │         │
       (needs context?)       │         │
            /         \       │         │
          v             v     │         │
    ┌─────────────┐     │     │         │
    │ stepContext │     │     │         │
    └─────┬───────┘     │     │         │
          │             │     │         │
          └─────────────┴─────┴─────────┘
                             │
                             v
                      shouldContinue()
                        /         \
                      v             v
                   __end__      (next step)
*/

/*
Task-based: executes the entire plan in one function call, converting all steps to Task objects and running them with dependency management.

Streaming/Iterative: Executes one step at a time, returning control to the graph after each step,using conditional edges to decide whether to continue or stop.

The latter would be much better for HITL integration.
  - Natural pause points - After each step, control returns to the graph where you can add human approval nodes
  - Incremental feedback - Humans can see progress and intervene at any step
  - Plan modification - Can adjust remaining steps based on human input or step results
  - Granular control - Easy to add conditional edges for human approval/rejection

Former problems for HITL:
  - All-or-nothing - Entire plan executes in one function call
  - No intervention points - Hard to pause mid-execution for human input
  - Batch processing - Human sees only final results, not intermediate steps


WORKFLOW: 
classify → createPlan → executeStep → shouldContinue → executeStep → ... → end
*/


/*
// HITL control
  waitingForHuman: boolean;
  humanInput: string;
  needsApproval: boolean;
  needsContext: boolean;
  confidenceScore: number;

  // Approval gates
  pendingApproval: {
    stepIndex: number;
    stepText: string;
    reason: string; // "db-change"
  };

  // Plan editing
  planEditable: boolean;

  New nodes:
  - humanApproval - Handle step approval/modification
  - waitForHuman - Pause for uncertainty resolution
  - collectContext - Gather additional text input
  - editPlan - Modify remaining steps

  detection:
  - DB update keywords: /(create|insert|update|delete|drop|alter)/i
  - Confidence: LLM outputs score 0-100

  workflow becomes:
  executeStep → checkApproval → [humanApproval] → shouldContinue
              ↓
          checkConfidence → [waitForHuman] → shouldContinue
              ↓
          checkContext → [collectContext] → shouldContinue

*/

const workflow = new StateGraph(PlanAnnotation)
  .addNode('classify', classifyQuery)
  .addNode('simple', simpleResponse)
  .addNode('createPlan', createPlan)
  .addNode('executeStep', executeStep)
  .addNode('stepApproval', stepApproval)
  .addNode('stepClarification', stepClarification)
  .addNode('stepContext', stepContext)

  .addEdge('__start__', 'classify')
  .addConditionalEdges('classify', shouldContinue)
  .addConditionalEdges('createPlan', shouldContinue)
  .addConditionalEdges('executeStep', shouldContinue)
  .addConditionalEdges('stepApproval', shouldContinue)
  .addConditionalEdges('stepClarification', shouldContinue)
  .addConditionalEdges('stepContext', shouldContinue)
  .addEdge('simple', '__end__');

const app = workflow.compile();

async function runAgent(userInput: string) {
  console.log(`\nUser: ${userInput}`);
  
  const initialState = {
    messages: [new HumanMessage(userInput)],
    isComplex: false,
    plan: []
  };
  
  const stream = await app.stream(initialState);
  let finalResult;
  
  for await (const step of stream) {
    const nodeName = Object.keys(step)[0];
    const nodeResult = step[nodeName];
    finalResult = nodeResult;
    
    if (nodeResult.messages && nodeResult.messages.length > 0) {
      const lastMessage = nodeResult.messages[nodeResult.messages.length - 1];
      console.log(`[${nodeName}]: ${lastMessage.content}`);
    }
  }
  
  return finalResult?.messages?.[finalResult.messages.length - 1]?.content || 'No response';
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: Please set your ANTHROPIC_API_KEY in the .env file');
    process.exit(1);
  }
  
  console.log('Starting Agent...');
  
  try {
    // simple
    await runAgent('Hello! Can you tell me what you are?');

    await runAgent('Hello. please get Amanda salary.')
    
    // pae
    await runAgent('Write a Python function that calculates the factorial of a number');

    // hitl
    // await runAgent('Create a new database table for user authentication with proper indexes and security');
    
  } catch (error) {
    console.error('Error running agent:', error);
  }
}

if (require.main === module) {
  main();
}