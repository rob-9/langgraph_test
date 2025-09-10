import { Annotation } from '@langchain/langgraph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { AgentTask, AgentMessage } from './types';

export const PlanAnnotation = Annotation.Root({
  messages: Annotation<(HumanMessage | AIMessage)[]>({
    reducer: (prev = [], next = []) => prev.concat(next)
  }),

  isComplex: Annotation<boolean>({
    reducer: (x, y) => y ?? x
  }),
  
  plan: Annotation<string[]>({
    reducer: (prev = [], next = []) => next.length > 0 ? next : prev
  }),
  
  currentStep: Annotation<number>({
    reducer: (x, y) => y ?? x
  }),
  
  waitingForHuman: Annotation<boolean>({
    reducer: (x, y) => y ?? x
  }),
  
  humanInput: Annotation<string>({
    reducer: (x, y) => y ?? x
  }),
  
  needsApproval: Annotation<boolean>({
    reducer: (x, y) => y ?? x
  }),
  
  needsContext: Annotation<boolean>({
    reducer: (x, y) => y ?? x
  }),
  
  confidenceScore: Annotation<number>({
    reducer: (x, y) => y ?? x
  }),
  
  pendingApproval: Annotation<any>({
    reducer: (x, y) => y ?? x
  }),
  
  approvedSteps: Annotation<number[]>({
    reducer: (prev = [], next = []) => prev.concat(next)
  }),
  
  tasks: Annotation<AgentTask[]>({
    reducer: (prev = [], next = []) => {
      if (next.length === 0) return prev;
      const merged = [...prev];
      next.forEach(newTask => {
        const existingIndex = merged.findIndex(t => t.id === newTask.id);
        if (existingIndex >= 0) {
          merged[existingIndex] = newTask;
        } else {
          merged.push(newTask);
        }
      });
      return merged;
    }
  }),
  
  allTasksCompleted: Annotation<boolean>({
    reducer: (x, y) => y ?? x
  }),
  
  executionResults: Annotation<string[]>({
    reducer: (prev = [], next = []) => prev.concat(next)
  }),
  
  // Multi-agent extensions
  currentAgent: Annotation<string>({
    reducer: (x, y) => y ?? x ?? 'zAI'
  }),
  
  agentMessages: Annotation<AgentMessage[]>({
    reducer: (prev = [], next = []) => prev.concat(next)
  }),
  
  delegatedTasks: Annotation<{[agentId: string]: string[]}>({
    reducer: (prev = {}, next = {}) => ({ ...prev, ...next })
  }),
  
  agentResponses: Annotation<{[taskId: string]: string}>({
    reducer: (prev = {}, next = {}) => ({ ...prev, ...next })
  }),
  
  
  // Enhanced task state with SDK features
  taskCheckpoints: Annotation<{[taskId: string]: any}>({
    reducer: (prev = {}, next = {}) => ({ ...prev, ...next })
  }),
  
  taskInterrupts: Annotation<{[taskId: string]: any[]}>({
    reducer: (prev = {}, next = {}) => ({ ...prev, ...next })
  })
});