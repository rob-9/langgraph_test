import { A2AClient } from '../client/client.js';
import { logger } from 'zyprova-common-lib/dist/logging/logger.js';
import { AgentCard } from '../schema.js';
import { generateSystemPrompt } from './llm.js';
import { AgentConfig } from 'zyprova-common-lib/dist/ai-agent/ai-agent.config.js';
import { agentConfig } from './config.js';

export type RegisteredAgentStatus = 'disconnected' | 'connected' | 'unknown';

export class RegisteredAgent {
  readonly clientUrl: string;

  readonly client: A2AClient;
  private status: RegisteredAgentStatus;
  private agentCard: AgentCard | null;

  constructor(url: string) {
    this.clientUrl = url;
    this.agentCard = null;
    this.client = new A2AClient(this.clientUrl);
  }

  async discover(): Promise<AgentCard | null> {
    if (this.agentCard !== null) {
      return this.agentCard;
    }

    // any exception occurs, ignore it and consider the client not registered
    try {
      this.agentCard = await this.client.agentCard();
      logger.debug(`Discovered agent at ${this.clientUrl}: ${JSON.stringify(this.agentCard)}`, 'agent-discovery');
      return this.agentCard;
    } catch (e) {
      logger.debug(`Exception during discovering agent at ${this.clientUrl}: ${JSON.stringify(e)}`, 'agent-discovery');
    }

    return null;
  }

  isRegistered() {
    return this.agentCard !== null;
  }

  getAgentCard(): Readonly<AgentCard> {
    return this.agentCard;
  }
}

type AgentName = string;
const registeredAgents: Record<AgentName, RegisteredAgent> = {};

export function getRegisteredAgent(agentName: string): RegisteredAgent | null {
  if (agentName in registeredAgents) return registeredAgents[agentName];
  return null;
}

export function getRegisteredAgents(): RegisteredAgent[] {
  return Object.values(registeredAgents);
}

function isAgentRegistered(agentUrl: string): boolean {
  for (const agentName in registeredAgents) {
    const agent = registeredAgents[agentName];
    if (agent.clientUrl === agentUrl) {
      return agent.isRegistered();
    }
  }

  return false;
}

async function registerAgent(url: string): Promise<boolean> {
  let agent = new RegisteredAgent(url);
  const agentCard = await agent.discover();
  if (agentCard) {
    registeredAgents[agentCard.name] = agent;
    return true;
  }

  return false;
}

export async function waitForRegisteredAgents(config: AgentConfig): Promise<void> {
  while (true) {
    const unregisteredAgents = config.requiredAgents.filter(agentUrl => !isAgentRegistered(agentUrl));
    if (unregisteredAgents.length === 0) {
      logger.debug('No registered agents, continuing.', 'agent-registration');
      return;
    }

    logger.debug(
      `Waiting for agents: ${unregisteredAgents.length}/${config.requiredAgents.length}`,
      'agent-registration',
    );
    const agentsRegistered: Promise<boolean>[] = [];
    for (const agentUrl of unregisteredAgents) {
      agentsRegistered.push(registerAgent(agentUrl));
    }

    const results = await Promise.all(agentsRegistered);
    if (results.filter(r => r === true).length == unregisteredAgents.length) {
      /* all agents registered */
      logger.log('All agents successfully registered.', 'agent-registration');
      generateSystemPrompt();
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 10 * 1000)); // wait 10 seconds before rediscovering agents
  }
}

export async function waitForAgents(): Promise<void> {
  logger.debug(`waitForAgents`, 'agent-registration');
  return await waitForRegisteredAgents(agentConfig);
}
