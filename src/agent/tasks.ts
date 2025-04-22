import { Task, TaskSendParams } from '../schema.js';
import { Anthropic } from '@anthropic-ai/sdk';
import { getRegisteredAgent } from './registered-agents.js';
import { generateTaskId } from './utils.js';
import { logger } from 'zyprova-common-lib/dist/logging/logger.js';

export class AgentTask {
  taskId: number;
  agent: string;
  description: string;
  response?: string;
  response_metadata?: Task | string;

  constructor(data: Record<string, any>) {
    this.taskId = data.taskId;
    this.agent = data.agent;
    this.description = data.description;
  }
}

export async function generateTasks(client: Anthropic, question: string): Promise<AgentTask[] | null> {
  const response = await client.messages.create({
    max_tokens: 1024,
    system: `You receive questions from user, then route questions to appropriate agents, and summarize their responses.
dr-ma agent has access to data for human resources, capital, and finances. It can perform CRUD operations on these datasets from human resources, to plans, etc.
analysis-ma agent can perform analysis between two sets of data.
forecast-ma agent can perform forecasts.
`,
    messages: [
      {
        role: 'user',
        content: `You were given the following question:
${question}
Use known agents to answer it. If possible, preserve the original question unless the question has to be broken down into multiple questions.
Generate a list of questions that each agent needs to answer. Use the following JSON structure: [{ "taskId": 1, "agent": "agent name", "description": "question" }, ...].
Don't explain why you are doing things or what do they mean.
`,
      },
    ],
    model: 'claude-3-5-sonnet-latest',
  });

  const r = response.content[0];
  if (r.type !== 'text') {
    console.error(
      `Unable to convert question: ${question} to graphql query. ${JSON.stringify(response)}`,
      'text-to-graphql',
    );
    return null;
  }

  return JSON.parse(r.text).map((data: Record<string, any>) => new AgentTask(data));
}

export function getTaskResponse(response: Task | string): string {
  if (typeof response === 'string') {
    return response;
  }

  if (
    response.status.message &&
    response.status.message.parts.length > 0 &&
    'text' in response.status.message.parts[0]
  ) {
    return response.status.message.parts[0].text;
  }

  return `ERROR parsing object: ${JSON.stringify(response)}`;
}

export async function delegateAgentTask(agent: string, task: string): Promise<Task | string> {
  const connectedAgent = getRegisteredAgent(agent);
  const currentTaskId = generateTaskId();
  const remoteTask: TaskSendParams = {
    id: currentTaskId,
    message: {
      role: 'user',
      parts: [{ type: 'text', text: task }],
    },
  };

  try {
    const result = await connectedAgent.client.sendTask(remoteTask);
    logger.debug(`result: ${JSON.stringify(result)}`, 'agentDelegate');
    return result;
  } catch (error: any) {
    return `ERROR:  ${error.message || error}`;
  }
}

export function generateSummary(tasks: AgentTask[]): string {
  const responses = tasks.map(t => t.response);
  logger.debug(`tasks.responses=${responses}`, 'generateSummary');

  if (tasks.length == 1) {
    return tasks[0].response;
  }

  throw Error(`Don't know how to generate summary of multiple tasks yet: ${JSON.stringify(responses)}`);
}
