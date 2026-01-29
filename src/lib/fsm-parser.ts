/**
 * FSM Parser - TypeScript port of validate.py
 * Parses and validates Finite State Machine definition files
 */

export interface FSMData {
  name: string;
  states: number;
  symbols: string[];
  transitions: Record<number, [string, string][]>;
  startstate: number;
  acceptstate: number;
}

export class FSMValidationError extends Error {
  lineNumber: number;

  constructor(lineNumber: number, message: string) {
    super(`Line ${lineNumber}: ${message}`);
    this.lineNumber = lineNumber;
    this.name = 'FSMValidationError';
  }
}

export class FSMParser {
  private static REQUIRED_FIELDS = ['name', 'states', 'symbols', 'transitions', 'startstate', 'acceptstate'];
  
  private data: {
    name: string | null;
    states: number | null;
    symbols: string[] | null;
    transitions: Record<number, [string, string][]>;
    startstate: number | null;
    acceptstate: number | null;
  };
  
  private fieldsFound: Set<string>;
  private currentLine: number;

  constructor() {
    this.data = {
      name: null,
      states: null,
      symbols: null,
      transitions: {},
      startstate: null,
      acceptstate: null,
    };
    this.fieldsFound = new Set();
    this.currentLine = 0;
  }

  parse(fileContent: string): FSMData {
    const lines = fileContent.split('\n');
    
    this.checkRequiredFields(lines);
    this.parseFields(lines);
    this.validateRules();
    
    return this.data as FSMData;
  }

  private checkRequiredFields(lines: string[]): void {
    const contentLower = lines.join('').toLowerCase();
    
    const missingFields: string[] = [];
    for (const field of FSMParser.REQUIRED_FIELDS) {
      if (!contentLower.includes(field)) {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      throw new FSMValidationError(0, `Missing required fields: ${missingFields.join(', ')}`);
    }
  }

  private parseFields(lines: string[]): void {
    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      this.currentLine = i + 1;
      
      if (!line) {
        i++;
        continue;
      }
      
      const lineLower = line.toLowerCase();
      
      if (lineLower.startsWith('name')) {
        this.parseName(line);
      } else if (lineLower.startsWith('states')) {
        this.parseStates(line);
      } else if (lineLower.startsWith('symbols')) {
        this.parseSymbols(line);
      } else if (lineLower.startsWith('transitions')) {
        i = this.parseTransitions(lines, i);
      } else if (lineLower.startsWith('startstate')) {
        this.parseStartState(line);
      } else if (lineLower.startsWith('acceptstate')) {
        this.parseAcceptState(line);
      }
      
      i++;
    }
  }

  private parseName(line: string): void {
    const match = line.match(/name\s*=\s*["'](.+?)["']/i);
    if (!match) {
      throw new FSMValidationError(this.currentLine, 'Name must be in format: Name = "value"');
    }
    this.data.name = match[1];
    this.fieldsFound.add('name');
  }

  private parseStates(line: string): void {
    const match = line.match(/states\s*=\s*["']?(\d+)["']?/i);
    if (!match) {
      throw new FSMValidationError(this.currentLine, 'States must be an integer');
    }
    this.data.states = parseInt(match[1], 10);
    this.fieldsFound.add('states');
  }

  private parseSymbols(line: string): void {
    const match = line.match(/symbols\s*=\s*\{(.+?)\}/i);
    if (!match) {
      throw new FSMValidationError(this.currentLine, 'Symbols must be in format: symbols = {0, 1}');
    }
    const symbolsStr = match[1];
    this.data.symbols = symbolsStr.split(',').map(s => s.trim());
    this.fieldsFound.add('symbols');
  }

  private parseTransitions(lines: string[], startIdx: number): number {
    this.fieldsFound.add('transitions');
    let i = startIdx + 1;
    
    while (i < lines.length) {
      const line = lines[i].trim();
      this.currentLine = i + 1;
      
      if (!line) {
        i++;
        continue;
      }
      
      const lineLower = line.toLowerCase();
      if (['name', 'states', 'symbols', 'startstate', 'acceptstate'].some(field => lineLower.startsWith(field))) {
        return i - 1;
      }
      
      // Match patterns like "0: 0.1, 1.0" or "1. 0.2, 2.2"
      const match = line.match(/(\d+)[:\.]?\s*(.+)/);
      if (!match) {
        throw new FSMValidationError(this.currentLine, `Invalid transition format: '${line}'`);
      }
      
      const state = parseInt(match[1], 10);
      const transitionsStr = match[2];
      
      const transitions: [string, string][] = [];
      for (const trans of transitionsStr.split(',')) {
        const trimmed = trans.trim();
        if (trimmed.includes('.')) {
          const parts = trimmed.split('.');
          if (parts.length !== 2) {
            throw new FSMValidationError(this.currentLine, `Invalid transition '${trimmed}'`);
          }
          transitions.push([parts[0].trim(), parts[1].trim()]);
        }
      }
      
      this.data.transitions[state] = transitions;
      i++;
    }
    
    return i;
  }

  private parseStartState(line: string): void {
    const match = line.match(/startstate\s*=\s*(\d+)/i);
    if (!match) {
      throw new FSMValidationError(this.currentLine, 'Start state must be an integer');
    }
    this.data.startstate = parseInt(match[1], 10);
    this.fieldsFound.add('startstate');
  }

  private parseAcceptState(line: string): void {
    const match = line.match(/acceptstate\s*=\s*(\d+)/i);
    if (!match) {
      throw new FSMValidationError(this.currentLine, 'Accept state must be an integer');
    }
    this.data.acceptstate = parseInt(match[1], 10);
    this.fieldsFound.add('acceptstate');
  }

  private validateRules(): void {
    const missing = FSMParser.REQUIRED_FIELDS.filter(field => !this.fieldsFound.has(field));
    if (missing.length > 0) {
      throw new FSMValidationError(0, `Missing required fields: ${missing.join(', ')}`);
    }
    
    const numStates = this.data.states!;
    const numTransitions = Object.keys(this.data.transitions).length;
    
    if (numTransitions !== numStates) {
      throw new FSMValidationError(0, `Number of transitions (${numTransitions}) must equal number of states (${numStates})`);
    }
    
    for (let stateNum = 1; stateNum <= numStates; stateNum++) {
      if (!(stateNum in this.data.transitions)) {
        throw new FSMValidationError(0, `State ${stateNum} has no transitions defined`);
      }
    }
    
    if (this.data.startstate! < 1 || this.data.startstate! > numStates) {
      throw new FSMValidationError(0, `Start state ${this.data.startstate} is invalid`);
    }
    
    if (this.data.acceptstate! < 1 || this.data.acceptstate! > numStates) {
      throw new FSMValidationError(0, `Accept state ${this.data.acceptstate} is invalid`);
    }
    
    const numSymbols = this.data.symbols!.length;
    for (const [state, transitions] of Object.entries(this.data.transitions)) {
      if (transitions.length !== numSymbols) {
        throw new FSMValidationError(0, `State ${state} has ${transitions.length} transitions but ${numSymbols} symbols defined`);
      }
    }
  }
}

/**
 * Run the FSM with given input and return result
 */
export function runFSM(fsm: FSMData, input: string): { 
  accepted: boolean; 
  path: { state: number; symbol?: string }[];
  endState: number;
  error?: string;
} {
  // Build transition map
  const transitionMap: Record<string, number> = {};
  for (const [state, transitionList] of Object.entries(fsm.transitions)) {
    for (const [inputSymbol, nextState] of transitionList) {
      const key = `${state}${inputSymbol}`;
      transitionMap[key] = parseInt(nextState, 10);
    }
  }
  
  let currentState = fsm.startstate;
  const path: { state: number; symbol?: string }[] = [{ state: currentState }];
  
  for (const symbol of input) {
    const key = `${currentState}${symbol}`;
    
    if (!(key in transitionMap)) {
      return {
        accepted: false,
        path,
        endState: currentState,
        error: `No transition for '${symbol}' from state ${currentState}`,
      };
    }
    
    const nextState = transitionMap[key];
    path.push({ state: nextState, symbol });
    currentState = nextState;
  }
  
  return {
    accepted: currentState === fsm.acceptstate,
    path,
    endState: currentState,
  };
}

/**
 * Parse FSM file content
 */
export function parseFSMFile(content: string): FSMData {
  const parser = new FSMParser();
  return parser.parse(content);
}
