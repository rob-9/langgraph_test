// read .env and populate process.env
import 'dotenv/config';

// wrapper around claude model
import { ChatAnthropic } from '@langchain/anthropic';

// stategraph: to build stateful agents. graph with nodes, edges, and conditional routing
// messagesannotation: declares how state fields are merged
import { StateGraph, MessagesAnnotation, Annotation } from '@langchain/langgraph';

// user / human input vs model / agent reply
import { HumanMessage, AIMessage } from '@langchain/core/messages';


// task representation for parallel execution
interface Task {
  id: string; // unique identifier for tracking
  description: string; // human readable task description
  dependencies: string[]; // array of task IDs that must complete first
  status: 'pending' | 'running' | 'completed' | 'failed'; // execution status
  result?: string; // task execution result once completed
  startTime?: Date; // when task execution began
  endTime?: Date; // when task execution finished
}
// defines shape of workflow's state for parallel execution
interface PlanState {
  messages: (HumanMessage | AIMessage)[]; // stores both types of messages
  isComplex: boolean; // messages can be both simple and complex
  tasks: Task[]; // array of tasks with parallel execution support
  allTasksCompleted: boolean; // flag to track when all tasks are done
  executionResults: string[]; // aggregated results from completed tasks
}

// declares the fields that make up the graph's state and how they should be merged when multiple nodes return updates
const PlanAnnotation = Annotation.Root({
  // messages: Annotation<(HumanMessage | AIMessage)[]>({
  //   reducer: (x, y) => x.concat(y) // append new messages to existing messages[]
  // }),

  // SAFER REDUCER - prevents crashes from null concats
  messages: Annotation<(HumanMessage | AIMessage)[]>({
    reducer: (prev = [], next = []) => prev.concat(next)
  }),

  isComplex: Annotation<boolean>({
    reducer: (x, y) => y ?? x // if not complex then stays False otherwise True
  }),
  
  // parallel task execution state fields
  tasks: Annotation<Task[]>({
    reducer: (prev = [], next = []) => {
      if (next.length === 0) return prev; // if no new tasks, keep previous
      // merge tasks by ID, preferring newer task data for updates
      const merged = [...prev];
      next.forEach(newTask => {
        const existingIndex = merged.findIndex(t => t.id === newTask.id);
        if (existingIndex >= 0) {
          merged[existingIndex] = newTask; // update existing task
        } else {
          merged.push(newTask); // add new task
        }
      });
      return merged;
    }
  }),
  
  allTasksCompleted: Annotation<boolean>({
    reducer: (x, y) => y ?? x // update completion status when provided
  }),
  
  executionResults: Annotation<string[]>({
    reducer: (prev = [], next = []) => prev.concat(next) // accumulate results
  })
});

// model client instance - low temp -> 
const model = new ChatAnthropic({
  model: 'claude-3-7-sonnet-20250219',
  apiKey: process.env.ANTHROPIC_API_KEY,
  temperature: 0.7,
});

// analyzes user queries to determine complexity and routing path
async function classifyQuery(state: typeof PlanAnnotation.State) {
  const lastMessage = state.messages[state.messages.length - 1];  // 54: Extract most recent user message
  
  const classificationPrompt = new HumanMessage(`               // 56: Create classification prompt
Analyze this user query and determine if it's SIMPLE or COMPLEX:

Query: "${lastMessage.content}"

A SIMPLE query is one that can be answered directly with existing knowledge (greetings, definitions, basic facts).
A COMPLEX query requires multiple steps, research, planning, or problem-solving.

Respond with only "SIMPLE" or "COMPLEX":
`);

  const response = await model.invoke([classificationPrompt]);    // 67: Send prompt to model for analysis
  const isComplex = response.content.toString().trim().toUpperCase() === 'COMPLEX'; // 68: Parse and normalize response
  
  console.log(`Query classification: ${isComplex ? 'COMPLEX' : 'SIMPLE'}`); // 70: Log classification result
  
  return {                                                       // 72: Return state updates
    isComplex,                                                   // 73: Set complexity flag
    currentStep: 0                                               // 74: Reset step counter
  };
}

// handles simple queries with direct model responses
async function simpleResponse(state: typeof PlanAnnotation.State) {
  console.log('Handling simple query directly');                // 79: Log simple handling mode
  
  const response = await model.invoke(state.messages);          // 81: Send all messages to model for response
  
  return {                                                      // 83: Return state updates
    messages: [response]                                        // 84: Add model response to message history
  };
}

// creates detailed execution plan for complex queries
async function createPlan(state: typeof PlanAnnotation.State) {
  const lastMessage = state.messages[state.messages.length - 1]; // 89: Get user's complex query
  
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
`);

  const response = await model.invoke([planningPrompt]); // 106: Ask model to create plan
  const planText = response.content.toString();          // 107: Extract plan text
  
  // Extract steps from the response
  const steps = planText.split('\n')                     // 110: Split response into lines
    .filter(line => /^\d+\./.test(line.trim()))          // 111: Keep only numbered lines
    .map(step => step.replace(/^\d+\.\s*/, '').trim());  // 112: Remove numbering, keep step text
  
  console.log('Generated plan with', steps.length, 'steps'); // 114: Log plan summary
  steps.forEach((step, i) => console.log(`  ${i + 1}. ${step}`)); // 115: Log each step
  
  return {
    plan: steps,                                         // 118: Store extracted steps
    messages: [new AIMessage(`I'll handle this complex query step by step:\n\n${steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}\n\nLet me start working through these steps...`)] // 119: Create response message
  };
}

// control flow logic - determines next workflow step
function shouldContinue(state: typeof PlanAnnotation.State) {
  if (!state.isComplex) {                             // 124: If query classified as simple
    return 'simple';                                  // 125: Route to simple response handler
  }
  if (!state.plan || state.plan.length === 0) {      // 127: If no plan exists yet
    return 'createPlan';                              // 128: Route to plan creation
  }
  return 'end';                                       // 130: Otherwise finish workflow
}

// workflow graph construction - defines agent's decision flow

/*
          __start__
              |
              v
        ┌─────────────-┐
        │   classify   │
        │(classifyQuery)
        └─────-┬───────┘
               │
        shouldContinue()
          /         \
        v             v
  ┌──────────--┐  ┌──────────--┐
  │   simple   │  │ createPlan │
  │(simpleResp)│  |(createPlan)│
  └────┬────--─┘  └────┬─────--┘
       │               │
       v               v
     __end__        __end__
*/

const workflow = new StateGraph(PlanAnnotation)       // 133: Create graph with state schema
  .addNode('classify', classifyQuery)                  // 134: Add query classification node
  .addNode('simple', simpleResponse)                   // 135: Add simple response handler
  .addNode('createPlan', createPlan)                   // 136: Add plan creation node
  .addEdge('__start__', 'classify')                    // 137: Start with classification
  .addConditionalEdges('classify', shouldContinue)     // 138: Route based on complexity
  .addEdge('simple', '__end__')                        // 139: Simple queries end here
  .addEdge('createPlan', '__end__');                   // 140: Planning ends workflow

const app = workflow.compile();                        // 142: Compile graph into executable

// agent execution function - main entry point for queries
async function runAgent(userInput: string) {
  console.log(`\nUser: ${userInput}`);                 // 145: Log user input
  
  const initialState = {                               // 147: Set up initial state
    messages: [new HumanMessage(userInput)],           // 148: Wrap input as message
    isComplex: false,
    plan: [],                                          // 149: Empty plan initially
    currentStep: 0                                     // 150: Start at step 0
  };
  
  const result = await app.invoke(initialState);       // 153: Execute workflow
  const lastMessage = result.messages[result.messages.length - 1]; // 154: Get final response
  
  console.log(`Agent: ${lastMessage.content}`);        // 156: Log agent response
  
  return lastMessage.content;                          // 158: Return response content
}

// main entry point & testing - validates agent functionality
async function main() {                                // 161: Main execution function
  if (!process.env.ANTHROPIC_API_KEY) {               // 162: Check for API key
    console.error('Error: Please set your ANTHROPIC_API_KEY in the .env file'); // 163: Error message
    process.exit(1);                                   // 164: Exit with error code
  }
  
  console.log('Starting Agent...');                    // 167: Startup message
  
  try {                                                // 169: Error handling wrapper
    // Simple queries                                  // 170: Test simple cases
    await runAgent('Hello! Can you tell me what you are?'); // 171: Greeting test
    await runAgent('What is 2 + 2?');                 // 172: Basic math test
    
    // Complex queries                                 // 174: Test complex cases
    await runAgent('Help me plan a comprehensive marketing strategy for a new tech startup'); // 175: Complex planning
    await runAgent('How can I optimize my team\'s workflow for better productivity and collaboration?'); // 176: Multi-step query
    
  } catch (error) {                                   // 178: Catch execution errors
    console.error('Error running agent:', error);     // 179: Log error details
  }
}

if (require.main === module) {                        // 183: Check if run directly
  main();                                              // 184: Execute main function
}