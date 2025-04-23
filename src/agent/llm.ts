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

export async function generateTasks(question: string): Promise<AgentTask[]> {
  if (MOCKED_TASKS) {
    logger.warn('generateTasks is mocked.', 'planning');
    return [
      {
        taskId: 1,
        agent: 'dr-ma',
        description: 'How many employees do we have?',
      },
    ];
  }

  const response = await llm.messages.create({
    max_tokens: 1024,
    system: getSystemPrompt(),
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
    logger.error(
      `Unable to convert question: ${question} to graphql query. ${JSON.stringify(response)}`,
      'text-to-graphql',
    );
    return [];
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
  if (!connectedAgent) {
    return `ERROR: unable to find registered agent ${agent}`;
  }
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
  logger.debug(`tasks.responses=${JSON.stringify(responses)}`, 'generateSummary');
  if (responses.length == 1) {
    return responses[0];
  }

  throw Error(`Don't know how to generate summary of multiple tasks yet: ${JSON.stringify(responses)}`);
}
