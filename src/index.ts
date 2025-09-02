import 'dotenv/config';
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
Create a step-by-step plan to answer this complex query:

Query: "${lastMessage.content}"

Provide a numbered list of specific steps needed to address this query thoroughly.
Each step should be clear and actionable.

Format your response as:
1. [Step 1]
2. [Step 2]
3. [Step 3]
...

Use a maximum of 7 steps.
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

async function executeStep(state: typeof PlanAnnotation.State) {
  const currentStepIndex = state.currentStep || 0;
  const currentStepText = state.plan[currentStepIndex];
  
  console.log(`Executing step ${currentStepIndex + 1}: ${currentStepText}`);
  
  const executionPrompt = new HumanMessage(`
Execute this specific step from the plan:

Step: "${currentStepText}"

Previous context from earlier steps:
${state.messages.slice(-3).map(m => m.content).join('\n\n')}

Provide a detailed response for this step only. Be thorough and actionable.
`);

  const response = await model.invoke([executionPrompt]);
  
  return {
    currentStep: currentStepIndex + 1,
    messages: [new AIMessage(`Step ${currentStepIndex + 1} completed: ${response.content}`)]
  };
}

function shouldContinue(state: typeof PlanAnnotation.State) {
  if (!state.isComplex) {
    return 'simple';
  }
  if (!state.plan || state.plan.length === 0) {
    return 'createPlan';
  }
  return 'end';
}

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
      v            v
   __end__      __end__
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

const workflow = new StateGraph(PlanAnnotation)
  .addNode('classify', classifyQuery)
  .addNode('simple', simpleResponse)
  .addNode('createPlan', createPlan)
  .addEdge('__start__', 'classify')
  .addConditionalEdges('classify', shouldContinue)
  .addEdge('simple', '__end__')
  .addEdge('createPlan', '__end__');

const app = workflow.compile();

async function runAgent(userInput: string) {
  console.log(`\nUser: ${userInput}`);
  
  const initialState = {
    messages: [new HumanMessage(userInput)],
    isComplex: false,
    plan: []
  };
  
  const result = await app.invoke(initialState);
  const lastMessage = result.messages[result.messages.length - 1];
  
  console.log(`Agent: ${lastMessage.content}`);
  
  return lastMessage.content;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: Please set your ANTHROPIC_API_KEY in the .env file');
    process.exit(1);
  }
  
  console.log('Starting Agent...');
  
  try {
    await runAgent('Hello! Can you tell me what you are?');
    await runAgent('What is 2 + 2?');
    
    await runAgent('Write a Python function that calculates the factorial of a number');
    await runAgent('Explain the differences between REST and GraphQL APIs with examples');
    
  } catch (error) {
    console.error('Error running agent:', error);
  }
}

if (require.main === module) {
  main();
}