import { A2AClient } from "../client/client.js";
import { logger } from 'zyprova-common-lib/dist/logging/logger.js';
import { AgentCard } from "../schema.js";

export type RegisteredAgentStatus =
| "disconnected"
| "connected"
| "unknown";

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

  async discover() : Promise<AgentCard | null> {
    if (this.agentCard !== null) {
      return this.agentCard;
    }

    // any exception occurs, ignore it and consider the client not registered
    try {
      this.agentCard = await this.client.agentCard();
      logger.debug(`Discovered agent at ${this.clientUrl}: ${JSON.stringify(this.agentCard)}`, 'agent-discovery');
      return this.agentCard;
    }
    catch(e) {
      logger.debug(`Exception during discovering agent at ${this.clientUrl}: ${JSON.stringify(e)}`, 'agent-discovery')
    }

    return null;
  }

  isRegistered() {
    return this.agentCard !== null;
  }
}

/* List of needed agents before this agent can provide any service */
let agentsEndpoints: string[] = [
  "http://dr-ma:41241",
  "http://analysis-ma:41241"
];

type AgentName = string;
const registeredAgents: Record<AgentName, RegisteredAgent> = {};

export function getRegisteredAgent(agentName: string): RegisteredAgent | null {
  return registeredAgents?.agentName ?? null;
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

export async function waitForRegisteredAgents(): Promise<void>  {
  while (true) {
    const unregisteredAgents = agentsEndpoints.filter(agentUrl => ! isAgentRegistered(agentUrl));
    if (unregisteredAgents.length === 0) {
      logger.debug('agent-registration complete.', 'agent-registration');
      return;
    }

    logger.debug(`Waiting for agents: ${unregisteredAgents.length}/${agentsEndpoints.length}`, 'agent-registration');    
    let registeredAgentsCount = 0;

    const agentsRegistered: Promise<boolean>[] = [];
    for (const agentUrl of unregisteredAgents) {
      agentsRegistered.push(registerAgent(agentUrl));
    }
    const results = await Promise.all(agentsRegistered);
    if (results.filter((r) => r === true).length == unregisteredAgents.length) {
      /* all agents registered */
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

export async function waitForAgents(): Promise<void> {
  logger.debug(`waitForAgents`, 'agent-registration');
  return await waitForRegisteredAgents();
}