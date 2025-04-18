import { A2AClient } from "../client/client.js";
  
export type RegisteredAgentStatus =
  | "disconnected"
  | "connected"
  | "unknown";

export class RegisteredAgent {
  client: A2AClient;
  clientUrl: string;
  name: string;
  status: RegisteredAgentStatus;
}

let registeredAgents: RegisteredAgent[] = [
  {
    client: new A2AClient("http://localhost:42241"),
    clientUrl: "http://localhost:42241",
    name: "dr-ma",
    status: "connected",
  },
  {
    client: new A2AClient("http://localhost:42242"),
    clientUrl: "http://localhost:42242",
    name: "analysis-ma",
    status: "connected",
  },
]

export function getRegisteredAgent(agent: string): RegisteredAgent | null {
  for (const connectedAgent of registeredAgents) {
    if (connectedAgent.name === agent) {
      return connectedAgent;
    }
  }
  return null;
}
