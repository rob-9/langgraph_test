import { logger } from 'zyprova-common-lib/dist/logging/logger.js';
import { GenerationResponseError, MessageData } from "genkit";
import { TaskYieldUpdate } from '../server/index.js';
import {
  TaskContext,
  A2AServer,
} from "../server/index.js";
import {
  AgentCard,
  Task,
  TextPart
} from "../schema.js";
import Anthropic from '@anthropic-ai/sdk';
import {
  AgentTask,
  generateTasks,
  getTaskResponse,
  delegateAgentTask,
  generateSummary,
} from './tasks.js';

const apiKey = process.env["ANTHROPIC_API_KEY"];
if (!apiKey) {
  throw Error("Please configure API key via ANTHROPIC_API_KEY variable.");
}
const MOCKED_TASKS: boolean = false
const AGENT_NAME = "zAI";
const llm: Anthropic = new Anthropic({apiKey: apiKey});

async function* taskReceived({
  task,
  history, // Extract history from context
}: TaskContext): AsyncGenerator<TaskYieldUpdate, Task | void, unknown> {
  // Use AsyncGenerator and correct return type
  const messages: MessageData[] = (history ?? [])
  .map((m) => ({
    role: (m.role === "agent" ? "model" : "user") as "user" | "model",
    content: m.parts
    .filter((p): p is TextPart => !!(p as TextPart).text)
    .map((p) => ({ text: p.text })),
  }))
  .filter((m) => m.content.length > 0);
  
  if (messages.length === 0) {
    console.warn(`${AGENT_NAME} No history/messages found for task ${task.id}`);
    yield {
      state: "failed",
      message: {
        role: "agent",
        parts: [
          { type: "text", text: "No input message found." }
        ],
      },
    };
    return;
  }
  
  logger.debug(`messages: ${JSON.stringify(messages)}`, AGENT_NAME)
  
  const last_message = messages[messages.length - 1]
  const last_content_message = last_message.content[last_message.content.length - 1]
  const question = last_content_message.text
  
  logger.log(`question: ${question}`, AGENT_NAME);
  let internal_data: Record<string, unknown> = {}
  let tasks: AgentTask[] = []
  
  if (MOCKED_TASKS) {
    tasks = [
      {
        taskId: 1,
        agent: "dr-ma",
        description: "How many employees do we have?"
      }
    ]
  } else {
    tasks = await generateTasks(llm, question);
    internal_data.tasks = tasks
  }
  
  for await (const task of tasks) {
    const response = await delegateAgentTask(task.agent, task.description);
    if (response) {
      task.response = getTaskResponse(response);
      task.response_metadata = response;
      logger.debug(`${task.agent}: ${JSON.stringify(task)}`, AGENT_NAME);
    }
  }
  
  const summary = generateSummary(tasks);
  
  yield {
    state: "completed",
    message: {
      role: "agent",
      parts: [
        {
          type: "text", text: summary, metadata: internal_data
        }
      ],
    },
  };
  
  return;
}

const port: number = 41241
const agentCard: AgentCard = {
  name: AGENT_NAME,
  description:
  "An agent that can perform corporate planning and analysis.",
  url: `http://localhost:${port}`,
  provider: {
    organization: "zyprova-internal",
  },
  version: "0.0.1",
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  authentication: null,
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  skills: [
    {
      id: "corporate-planning",
      name: "zAI Agent",
      description:
      "Corporate planning and analysis.",
      tags: ["financial", "planning" ],
      examples: [
        "I need help to predict profit and loss. Please conduct a predictive analysis to forecast profit and loss for rest of the year, that is from April to December. Assume 20% annual headcount increase, 500% sales revenue increase by the end of year. Please provide month by month forcast for each accont. Please run analysis for each line item in the attached report and share factor used, also provide commentary for overall profit and loss by the end of the year after your forecast.",
        "How many employees does the company have?",
        "How would a plan with 4 L4 employees look like? What would be the impact?"
      ],
    },
  ],
};

const server = new A2AServer(taskReceived, { card: agentCard });

server.start(port);

logger.log(`Server started on ${agentCard.url}`, AGENT_NAME);
logger.log(`Press Ctrl+C to stop the server`, AGENT_NAME);
