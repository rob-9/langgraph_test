import 'dotenv/config';
import { ChatAnthropic } from '@langchain/anthropic';
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

const model = new ChatAnthropic({
  model: 'claude-3-haiku-20240307',
  apiKey: process.env.ANTHROPIC_API_KEY,
  temperature: 0.7,
});

async function callModel(state: typeof MessagesAnnotation.State) {
  console.log('Calling model with messages:', state.messages.length);
  
  const response = await model.invoke(state.messages);
  
  return {
    messages: [response]
  };
}

const workflow = new StateGraph(MessagesAnnotation)
  .addNode('agent', callModel)
  .addEdge('__start__', 'agent')
  .addEdge('agent', '__end__');

const app = workflow.compile();

async function runAgent(userInput: string) {
  console.log(`\nUser: ${userInput}`);
  
  const initialState = {
    messages: [new HumanMessage(userInput)]
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
    
    await runAgent('What can you help me with?');
    
    await runAgent('Can you explain what LangGraph is in simple terms?');
    
  } catch (error) {
    console.error('Error running agent:', error);
  }
}

if (require.main === module) {
  main();
}