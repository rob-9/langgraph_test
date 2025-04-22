import { logger } from 'zyprova-common-lib/dist/logging/logger.js';
import { MessageData } from 'genkit';
import { TaskYieldUpdate } from '../server/index.js';
import { TaskContext, A2AServer } from '../server/index.js';
import { Task, TextPart } from '../schema.js';
import { generateTasks, getTaskResponse, delegateAgentTask, generateSummary } from './llm.js';
import { waitForAgents } from './registered-agents.js';
import { AGENT_NAME, AGENT_CARD } from './agent-card.js';
import { getListenIpAddressFromUrl, getPortFromUrl } from './utils.js';

async function* taskReceived({
  task,
  history, // Extract history from context
}: TaskContext): AsyncGenerator<TaskYieldUpdate, Task | void, unknown> {
  // Use AsyncGenerator and correct return type
  const messages: MessageData[] = (history ?? [])
    .map(m => ({
      role: (m.role === 'agent' ? 'model' : 'user') as 'user' | 'model',
      content: m.parts.filter((p): p is TextPart => !!(p as TextPart).text).map(p => ({ text: p.text })),
    }))
    .filter(m => m.content.length > 0);

  if (messages.length === 0) {
    console.warn(`${AGENT_NAME} No history/messages found for task ${task.id}`);
    yield {
      state: 'failed',
      message: {
        role: 'agent',
        parts: [{ type: 'text', text: 'No input message found.' }],
      },
    };
    return;
  }

  logger.debug(`messages: ${JSON.stringify(messages)}`, AGENT_NAME);

  const last_message = messages[messages.length - 1];
  const last_content_message = last_message.content[last_message.content.length - 1];
  const question = last_content_message.text;
  if (!question) {
    yield {
      state: 'failed',
      message: {
        role: 'agent',
        parts: [{ type: 'text', text: 'Unable to extract question from the context.' }],
      },
    };
    return;
  }

  logger.log(`question: ${question}`, AGENT_NAME);
  let internal_data: Record<string, unknown> = {};

  const tasks = await generateTasks(question);
  internal_data.tasks = tasks;

  for await (const task of tasks) {
    const response = await delegateAgentTask(task.agent, task.description);
    if (response) {
      task.response = getTaskResponse(response);
      task.response_metadata = response;
      logger.debug(`${task.agent}: ${JSON.stringify(task)}`, AGENT_NAME);
    }
  }

  const summary = generateSummary(tasks);

  logger.log(`response: ${summary}`, AGENT_NAME);

  yield {
    state: 'completed',
    message: {
      role: 'agent',
      parts: [
        {
          type: 'text',
          text: summary,
          metadata: internal_data,
        },
      ],
    },
  };

  return;
}

const server = new A2AServer(taskReceived, { card: AGENT_CARD });

waitForAgents().then(() => {
  const listenPort = getPortFromUrl(AGENT_CARD.url);
  const listenIpAddress = getListenIpAddressFromUrl(AGENT_CARD.url);
  server.start(listenPort, listenIpAddress);
  logger.log(`A2AServer started at ${listenIpAddress}:${listenPort}, discoverable at ${AGENT_CARD.url}`, AGENT_NAME);
});
