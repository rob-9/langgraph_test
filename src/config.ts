export interface SystemConfig {
  use_pae: boolean;        // Global plan-and-execute setting (can be overridden per agent)
  enable_hitl: boolean;    // Enable human-in-the-loop gates for approvals and clarifications
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;                    // What this agent does
  capabilities: string[];                // List of capabilities/skills
  enable_hitl: boolean;                  // Agent-specific HITL setting
  canPAE: boolean;                       // Can use plan-and-execute workflow
}

export const SYSTEM_CONFIG: SystemConfig = {
  use_pae: true,        // Most agents use plan-and-execute by default
  enable_hitl: process.env.ENABLE_HITL === 'true' || false    // Configurable via environment
};

// SDK Configuration for enhanced task tracking
export const SDK_CONFIG = {
  apiUrl: process.env.LANGGRAPH_API_URL,
  apiKey: process.env.LANGGRAPH_API_KEY || process.env.LANGSMITH_API_KEY,
  enablePersistence: process.env.ENABLE_SDK_PERSISTENCE === 'true' || false,
  timeout: 30000,
  maxRetries: 3
};

export const AGENT_CONFIGS: Record<string, AgentConfig> = {
  zAI: {
    id: 'zAI',
    name: 'zAI Orchestrator',
    description: 'Top-level coordinator that creates plans and delegates tasks to specialized agents',
    capabilities: ['planning', 'delegation', 'coordination', 'general_tasks', 'task_routing'],
    enable_hitl: false,
    canPAE: true        // Can use PAE workflow
  },
  HR: {
    id: 'HR',
    name: 'HR Agent',
    description: 'Leaf agent that handles employee data queries and converts them to GraphQL',
    capabilities: ['employee_data', 'salary_info', 'hiring', 'performance_reviews', 'graphql_queries', 'staff_management'],
    enable_hitl: false,
    canPAE: false       // Direct execution only (no PAE)
  },
  FPA: {
    id: 'FPA',
    name: 'Financial Process Automation',
    description: 'Agent specializing in financial analysis, reporting, and financial metrics only',
    capabilities: ['financial_analysis', 'financial_reporting', 'budgeting', 'financial_metrics', 'revenue_analysis', 'profit_analysis', 'burn_rate', 'runway_calculation'],
    enable_hitl: false,
    canPAE: false       // Direct execution only (no PAE)
  }
};