import { config, validateConfig } from 'zyprova-common-lib/dist/config/index.js';
import { AgentConfig } from 'zyprova-common-lib/dist/ai-agent/ai-agent.config.js';

export const agentConfig = validateConfig(AgentConfig, config.agent || {});
