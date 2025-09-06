import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { PlanAnnotation } from './state';
import { AGENT_CONFIGS, SYSTEM_CONFIG } from './config';
import { HR_GRAPHQL_SCHEMA } from './schemas/hr-schema';

const model = new ChatAnthropic({
  model: 'claude-3-7-sonnet-20250219',
  apiKey: process.env.ANTHROPIC_API_KEY,
  temperature: 0.7,
});

export async function classifyQuery(state: typeof PlanAnnotation.State) {
  const lastMessage = state.messages[state.messages.length - 1];
  
  const classificationPrompt = new HumanMessage(`
    Analyze this user query and determine if it's SIMPLE or COMPLEX:

    Query: "${lastMessage.content}"

    A SIMPLE query is one that can be answered directly with existing knowledge (greetings, definitions, basic facts) that does not need a workflow to answer. 
    A COMPLEX query requires multiple steps, research, planning, or problem-solving to generate a satisfactory response.

    Respond with only "SIMPLE" or "COMPLEX":
`);

  const response = await model.invoke([classificationPrompt]);
  const isComplex = response.content.toString().trim().toUpperCase() === 'COMPLEX';
  
  console.log(`Query classification: ${isComplex ? 'COMPLEX' : 'SIMPLE'}`);
  
  return {
    isComplex
  };
}

export async function simpleResponse(state: typeof PlanAnnotation.State) {
  const response = await model.invoke(state.messages);
  
  return {
    messages: [response]
  };
}

export async function directAgentExecution(state: typeof PlanAnnotation.State) {
  const lastMessage = state.messages[state.messages.length - 1];
  const query = lastMessage.content.toString();
  
  // Import functions to avoid circular imports
  const { determineResponsibleAgent, delegateTask } = await import('./agents');
  const responsibleAgent = determineResponsibleAgent(query);
  const response = await delegateTask(responsibleAgent, query);
  
  return {
    messages: [new AIMessage(`${response}`)]
  };
}

export async function createPlan(state: typeof PlanAnnotation.State) {
  const lastMessage = state.messages[state.messages.length - 1];
  
  // Enhanced planning prompt that considers agent capabilities
  const agentCapabilities = Object.entries(AGENT_CONFIGS)
    .map(([id, config]) => `${id}: ${config.capabilities.join(', ')}`)
    .join('\n');
    
  const agentContext = `
    HR AGENT CONTEXT:
    - Has access to full GraphQL schema for employee and financial data
    - Returns actual data when function exists for the task, otherwise random numbers
    - Can query employees, plans, transactions, financial metrics, etc.

    FULL GRAPHQL SCHEMA:
    ${HR_GRAPHQL_SCHEMA}

    FPA AGENT CONTEXT:
    - FINANCIAL TASKS ONLY: revenue, profit, budgets, burn rate, financial metrics, reports
    - Cannot handle: coding, general analysis, non-financial tasks
    - Has access to financial queries: getBurnRate, getRevenue, profitMargin, ebitda, etc.
`;
    
  const planningPrompt = new HumanMessage(`
    Create a concise, actionable plan to complete this task with specific agent assignments:

    Query: "${lastMessage.content}"

    ${agentContext}

    Available agents and their capabilities:
    ${agentCapabilities}

    Provide 2-4 specific, executable steps that directly accomplish the task.
    For each step, specify which agent should handle it based on their capabilities.

    IMPORTANT: 
    - HR: Use for employee data, salary queries, HR-related tasks
    - FPA: Use ONLY for financial analysis, budgets, revenue, financial reports
    - zAI: Use for general tasks, coordination, non-financial analysis

    Format your response as:
    1. [Agent: AGENT_NAME] - [Step description]
    2. [Agent: AGENT_NAME] - [Step description]
    3. [Agent: AGENT_NAME] - [Step description]

    Maximum 4 steps. Each step should produce a concrete deliverable.
`);

  const response = await model.invoke([planningPrompt]);
  const planText = response.content.toString();
  
  // Parse steps with agent assignments
  const stepLines = planText.split('\n')
    .filter(line => /^\d+\./.test(line.trim()))
    .map(line => line.replace(/^\d+\.\s*/, '').trim());
    
  const steps = stepLines.map(stepLine => {
    // Extract agent assignment if present
    const agentMatch = stepLine.match(/\[Agent:\s*(\w+)\]\s*-\s*(.+)/i);
    if (agentMatch) {
      return {
        text: agentMatch[2].trim(),
        agent: agentMatch[1]
      };
    }
    return {
      text: stepLine,
      agent: 'zAI' // Default to zAI if no agent specified
    };
  });
  
  // Plan generated (will be displayed in workflow output)
  
  // Convert to simple string array for compatibility with existing code
  const planSteps = steps.map(step => `[${step.agent}] ${step.text}`);
  
  return {
    plan: planSteps,
    currentStep: 0,
    messages: [new AIMessage(`I'll handle this complex query step by step with agent coordination:\n\n${steps.map((step, i) => `${i + 1}. [${step.agent}] ${step.text}`).join('\n')}\n\nLet me start coordinating these steps...`)]
  };
}

export async function executeStep(state: typeof PlanAnnotation.State) {
  const currentStepIndex = state.currentStep || 0;
  const currentStepText = state.plan[currentStepIndex];
  
  console.log(`Executing step ${currentStepIndex + 1}: ${currentStepText}`);
  
  const approval = requiresApproval(currentStepText);
  const isApproved = (state.approvedSteps || []).includes(currentStepIndex);
  
  if (approval.required && !isApproved) {
    return {
      needsApproval: true,
      pendingApproval: {
        stepIndex: currentStepIndex,
        stepText: currentStepText,
        reason: approval.reason
      }
    };
  }
  
  const executionPrompt = new HumanMessage(`
    Execute this specific step from the plan:

    Step: "${currentStepText}"

    Previous context from earlier steps:
    ${state.messages.slice(-3).map(m => m.content).join('\n\n')}

    Rate your confidence (0-100) in completing this step successfully, then provide your response.
    Format: "Confidence: [score]\n\n[your response]"
`);

  const response = await model.invoke([executionPrompt]);
  const responseText = response.content.toString();
  
  const confidenceMatch = responseText.match(/Confidence:\s*(\d+)/i);
  const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 100;
  
  if (confidence < 70) {
    return {
      waitingForHuman: true,
      confidenceScore: confidence,
      messages: [new AIMessage(`Step ${currentStepIndex + 1} - Low confidence (${confidence}%): ${responseText}`)]
    };
  }
  
  return {
    currentStep: currentStepIndex + 1,
    confidenceScore: confidence,
    messages: [new AIMessage(`Step ${currentStepIndex + 1} completed: ${responseText}`)]
  };
}

export async function stepApproval(state: typeof PlanAnnotation.State) {
  const { stepIndex, stepText, reason } = state.pendingApproval;
  
  console.log(`\nAPPROVAL REQUIRED (${reason})`);
  console.log(`Step ${stepIndex + 1}: ${stepText}`);
  console.log(`Options: [a]pprove, [m]odify, [s]kip, [e]dit remaining plan`);
  
  // In real implementation, this would wait for actual human input
  // For now, simulate approval
  const humanDecision: string = 'a'; // simulate approve
  
  switch (humanDecision) {
    case 'a': // approve  
      return {
        needsApproval: false,
        pendingApproval: null,
        approvedSteps: [stepIndex]
      };
    case 'm': // modify step
      const modifiedStep = stepText; // In real app, get from human input
      const updatedPlan = [...state.plan];
      updatedPlan[stepIndex] = modifiedStep;
      return {
        needsApproval: false,
        pendingApproval: null,
        plan: updatedPlan
      };
    case 's': // skip step
      return {
        needsApproval: false,
        pendingApproval: null,
        currentStep: (state.currentStep || 0) + 1
      };
    case 'e': // edit remaining plan
      return {
        needsApproval: false,
        pendingApproval: null,
        waitingForHuman: true
      };
    default:
      return { needsApproval: false, pendingApproval: null };
  }
}

export async function stepClarification(state: typeof PlanAnnotation.State) {
  console.log(`\nCLARIFICATION NEEDED`);
  console.log(`Confidence: ${state.confidenceScore}%`);
  console.log(`Current situation requires human guidance.`);
  console.log(`Options: [c]ontinue anyway, [p]rovide guidance, [r]eplan remaining steps`);
  
  const humanDecision: string = 'c';
  
  if (humanDecision === 'c') {
    return {
      waitingForHuman: false,
      confidenceScore: 100
    };
  } else if (humanDecision === 'p') {
    const guidance = "Proceed with the suggested approach";
    return {
      waitingForHuman: false,
      humanInput: guidance,
      confidenceScore: 100
    };
  } else if (humanDecision === 'r') {
    return {
      waitingForHuman: false,
      needsContext: true
    };
  }
  return { waitingForHuman: false };
}

export async function stepContext(state: typeof PlanAnnotation.State) {
  console.log(`\nCONTEXT COLLECTION`);
  console.log(`Additional information needed to proceed.`);
  
  const additionalContext = "User provided additional context here";
  
  return {
    needsContext: false,
    humanInput: additionalContext,
    messages: [new AIMessage(`Context added: ${additionalContext}`)]
  };
}

function requiresApproval(stepText: string): { required: boolean; reason: string } {
  const dbKeywords = /(create|insert|update|delete|drop|alter|modify|remove)/i;
  const hasDbOperation = dbKeywords.test(stepText);
  
  if (hasDbOperation) return { required: true, reason: "db-change" };
  return { required: false, reason: "" };
}

export async function aggregateResults(state: typeof PlanAnnotation.State) {
  const originalQuery = state.messages[0].content.toString();
  const agentResponses = Object.values(state.agentResponses || {});
  const planSteps = state.plan || [];
  
  // Aggregating results
  
  const aggregationPrompt = new HumanMessage(`
    You are zAI, the orchestrator agent. You delegated a complex task to various specialized agents and received their responses.

    Original user query: "${originalQuery}"

    Plan steps executed: 
    ${planSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

    Agent responses received:
    ${agentResponses.map((response, i) => `- ${response}`).join('\n')}

    Please provide a comprehensive final answer to the user's original query by synthesizing all agent responses. 
    Be concise but complete, and acknowledge which agents contributed to the solution.
`);

  const response = await model.invoke([aggregationPrompt]);
  
  return {
    messages: [new AIMessage(`[zAI Final Result] ${response.content}`)]
  };
}

export function shouldContinue(state: typeof PlanAnnotation.State) {
  if (!state.isComplex) {
    return 'simple';
  }
  
  // Check if this is an HR-type query that should bypass PAE
  if (state.isComplex) {
    const lastMessage = state.messages[state.messages.length - 1];
    const query = lastMessage.content.toString().toLowerCase();
    
    // HR queries should go directly to agent execution
    if (/(salary|employee|amanda|hr|staff|personnel)/i.test(query)) {
      return 'directAgentExecution';
    }
  }
  
  if (!state.plan || state.plan.length === 0) {
    return 'createPlan';
  }
  
  // Skip HITL checks if disabled in config
  if (SYSTEM_CONFIG.enable_hitl) {
    if (state.needsApproval) {
      return 'stepApproval';
    }
    if (state.waitingForHuman) {
      return 'stepClarification';
    }
    if (state.needsContext) {
      return 'stepContext';
    }
  }
  
  const currentStep = state.currentStep || 0;
  if (currentStep < state.plan.length) {
    // Use multi-agent coordination instead of direct execution
    return 'coordinateAgents';
  }
  
  // All steps completed - aggregate results
  return 'aggregateResults';
}