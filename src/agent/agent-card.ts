import { AgentCard } from '../schema.js';
import { agentConfig } from './config.js';
import { logger } from 'zyprova-common-lib/dist/logging/index.js';
import { resolveHostname } from './utils.js';

export async function getConfiguredAgentUrl(agentName: string): Promise<string> {
  if (agentConfig.url) return agentConfig.url;

  /**
   * Try resolving <agentName>-ma as a hostname
   * Try resolving agentName as a hostname
   * If none of that works, throw an exception.
   */

  const port = agentConfig.port ?? 41241;
  for (const agentHost of [agentName + '-ma', agentName]) {
    try {
      logger.debug(
        `No URL specified, trying to auto-detect URL based on Agent's name=${AGENT_NAME} => agentHost=${agentHost}`,
        'auto-detect-agent-url',
      );
      await resolveHostname(agentHost);
      const agentUrl = `http://${agentHost.toLowerCase()}:${port}`;
      logger.log(`Agent's URL set to ${agentUrl}`, 'auto-detect-agent-url');
      return agentUrl;
    } catch (error) {
      logger.warn(`DNS resolution for ${agentHost} failed.`, 'auto-detect-agent-url');
      // ignore errors
    }
  }

  throw Error(`Unable to detect agent's URL in agent configuration: ${JSON.stringify(agentConfig)}`);
}

export const AGENT_NAME = 'zAI';
export const AGENT_CARD: AgentCard = {
  name: AGENT_NAME,
  description: 'An agent that can perform corporate planning and analysis.',
  url: await getConfiguredAgentUrl(AGENT_NAME),
  provider: {
    organization: 'zyprova',
  },
  version: '0.0.1',
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  authentication: null,
  defaultInputModes: ['text'],
  defaultOutputModes: ['text'],
  skills: [
    {
      id: 'corporate-planning',
      name: 'zAI Agent',
      description: 'Corporate planning and analysis.',
      tags: ['financial', 'planning'],
      examples: [
        'I need help to predict profit and loss. Please conduct a predictive analysis to forecast profit and loss for rest of the year, that is from April to December. Assume 20% annual headcount increase, 500% sales revenue increase by the end of year. Please provide month by month forecast for each account. Please run analysis for each line item in the attached report and share factor used, also provide commentary for overall profit and loss by the end of the year after your forecast.',
        'How many employees does the company have?',
        'How would a plan with 4 L4 employees look like? What would be the impact?',
      ],
    },
  ],
};
