import { Task, TaskSendParams } from '../schema.js';
import { Anthropic } from '@anthropic-ai/sdk';
import { getRegisteredAgent, getRegisteredAgents } from './registered-agents.js';
import { generateTaskId } from './utils.js';
import { logger } from 'zyprova-common-lib/dist/logging/logger.js';
import { AgentTask } from './agent-task.js';

const MOCKED_TASKS: boolean = false;

const apiKey = process.env['ANTHROPIC_API_KEY'];
if (!apiKey) {
  throw Error('Please configure API key via ANTHROPIC_API_KEY variable.');
}
const llm: Anthropic = new Anthropic({ apiKey: apiKey });

var systemPrompt = '';

export function generateSystemPrompt(): string {
  let systemPromptHeader =
    'You receive questions from user, then route questions to appropriate agents, and summarize their responses.\n';
  systemPrompt = systemPromptHeader;

  for (const agent of getRegisteredAgents()) {
    const agentCard = agent.getAgentCard();
    const agentSkill = agentCard.description;
    const agentName = agentCard.name;
    systemPrompt += agentName + ':\n';
    for (const skill of agentCard.skills) {
      systemPrompt += ' - ' + skill.description + '\n';
    }
  }
  logger.debug(`System prompt generated: ${systemPrompt}`, 'system-prompt');
  return systemPrompt;
}

function getSystemPrompt(): string {
  return systemPrompt;
}

export async function generateTasks(question: string, sessionId: string): Promise<AgentTask[]> {
  if (MOCKED_TASKS) {
    logger.warn('generateTasks is mocked.', 'planning');
    return [
      {
        taskId: 1,
        sessionId: sessionId,
        agent: 'dr-ma',
        description: 'How many employees do we have?',
      },
    ];
  }

  const user_prompt = `
You were given the following question:
${question}
Use known agents to answer it. If possible, preserve the original question unless the question has to be broken down into multiple questions.
Generate a list of questions that each agent needs to answer. Use the following JSON structure: [{ "taskId": 1, "agent": "agent name", "description": "question" }, ...].
Don't explain why you are doing things or what do they mean.
`;

  console.debug(user_prompt, 'generate-tasks.user-prompt');
  const response = await llm.messages.create({
    max_tokens: 1024,
    system: getSystemPrompt(),
    messages: [
      {
        role: 'user',
        content: user_prompt,
      },
    ],
    model: 'claude-3-5-sonnet-latest',
  });

  const r = response.content[0];
  if (r.type !== 'text') {
    logger.error(
      `Unable to convert question: ${question} to graphql query. ${JSON.stringify(response)}`,
      'text-to-graphql',
    );
    return [];
  }

  logger.debug(`${r.text}`, `task-list`);
  return JSON.parse(r.text).map((data: Record<string, any>) => new AgentTask(data, sessionId));
}

export function getTaskMetadata(agentTasks: AgentTask[]): Record<string, any> {
  const metadata: Record<string, any> = {}
  metadata.queries = [];
  for (const agentTask of agentTasks) {
    const responseMetadata = agentTask.response_metadata as Task;
    if (!responseMetadata) continue;
    if (!responseMetadata.status.message) continue;
    if (responseMetadata.status.message.role !== 'agent') continue;
    for (const part of responseMetadata.status.message.parts) {
      if (!part.metadata) continue;
      if (!part.metadata?.queries) continue;
      metadata.queries = [...metadata.queries, part.metadata.queries]
    }
  }
  return metadata;
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

export async function delegateAgentTask(task: AgentTask): Promise<Task | string> {
  const connectedAgent = getRegisteredAgent(task.agent);
  if (!connectedAgent) {
    return `ERROR: unable to find registered agent ${task.agent}`;
  }
  const currentTaskId = generateTaskId();
  const remoteTask: TaskSendParams = {
    id: currentTaskId,
    sessionId: task.sessionId,
    message: {
      role: 'user',
      parts: [{ type: 'text', text: task.description }],
    },
    metadata: task.metadata,
  };

  try {
    const result = await connectedAgent.client.sendTask(remoteTask);
    if (!result) {
      logger.debug('task submitted, nothing returned.', 'agentDelegate');
      return '';
    }
    logger.debug(`result: ${JSON.stringify(result)}`, 'agentDelegate');
    return result;
  } catch (error: any) {
    return `ERROR:  ${error.message || error}`;
  }
}

export function generateSummary(tasks: AgentTask[]): string {
  const responses = tasks.map(t => t?.response ?? '');
  logger.debug(JSON.stringify(responses), 'generateSummary');
  if (responses.length == 1) {
    return responses[0];
  }

  throw Error(`Don't know how to generate summary of multiple tasks yet: ${JSON.stringify(responses)}`);
}
