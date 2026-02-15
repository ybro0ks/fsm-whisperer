/**
 * FSM Step Generator - Generates step-by-step state visualization data
 * Ported from Java FSM utility
 */

import { FSMData } from './fsm-parser';

export interface StateStep {
  currentState: number;
  nextState: number | null;
  upcomingInput: string | null;
}

export interface StepResult {
  position: number;
  symbol: string;
  isAnchor: boolean;
  states: StateStep[];
}

export interface GenerationResult {
  steps: StepResult[];
}

/**
 * Get transition for a given state and symbol
 */
function getTransition(fsmData: FSMData, state: number, symbol: string): number | null {
  const stateTransitions = fsmData.transitions[state];
  if (!stateTransitions) return null;

  for (const [inputSymbol, nextState] of stateTransitions) {
    if (inputSymbol === symbol) {
      return parseInt(nextState, 10);
    }
  }
  return null;
}

/**
 * Generate FSM steps for visualization
 * 
 * @param fsmData - The FSM data from context
 * @param input - The input string to process
 * @returns Structured JSON object with step data
 */
export function generateFSMSteps(fsmData: FSMData, input: string): GenerationResult {
  const steps: StepResult[] = [];
  
  // Determine chunk size from first symbol length
  const chunkSize = fsmData.symbols[0]?.length || 1;
  
  // Split input into chunks
  const chunks: string[] = [];
  for (let i = 0; i < input.length; i += chunkSize) {
    chunks.push(input.slice(i, i + chunkSize));
  }

  if (chunks.length === 0) {
    return { steps: [] };
  }

  // Process each chunk
  for (let position = 0; position < chunks.length; position++) {
    const symbol = chunks[position];
    const upcomingInput = position < chunks.length - 1 ? chunks[position + 1] : null;
    const isAnchor = position === 0;

    const stateResults: StateStep[] = [];

    if (isAnchor) {
      // Anchor position: only show the start state (state 1)
      const nextState = getTransition(fsmData, fsmData.startstate, symbol);
      stateResults.push({
        currentState: fsmData.startstate,
        nextState: nextState,
        upcomingInput: upcomingInput,
      });
    } else {
      // Non-anchor: iterate through all states for competing tiles
      for (let stateNum = 1; stateNum <= fsmData.states; stateNum++) {
        const nextState = getTransition(fsmData, stateNum, symbol);
        stateResults.push({
          currentState: stateNum,
          nextState: nextState,
          upcomingInput: upcomingInput,
        });
      }
    }

    steps.push({
      position,
      symbol,
      isAnchor,
      states: stateResults,
    });
  }

  return { steps };
}
