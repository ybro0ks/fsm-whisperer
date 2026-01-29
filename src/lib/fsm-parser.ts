/**
 * FSM Parser - TypeScript port of validate.py
 * Parses and validates Finite State Machine definition files
 * Supports both 0-based and 1-based state indexing
 */

export interface FSMData {
  name: string;
  states: number;
  symbols: string[];
  transitions: Record<number, [string, string][]>;
  startstate: number;
  acceptstate: number;
  zeroIndexed: boolean; // Track which indexing scheme is used
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
    zeroIndexed: boolean;
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
      zeroIndexed: false,
    };
    this.fieldsFound = new Set();
    this.currentLine = 0;
  }

  parse(fileContent: string): FSMData {
    const lines = fileContent.split('\n');
    
    this.checkRequiredFields(lines);
    this.parseFields(lines);
    this.detectAndNormalizeIndexingScheme();
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
    
    // Check if the first transition is on the same line as "transitions ="
    const firstLine = lines[startIdx].trim();
    const inlineMatch = firstLine.match(/transitions\s*=\s*(\d+[:\.]?\s*.+)/i);
    
    let i = startIdx;
    if (inlineMatch) {
      // Parse inline transition on same line as "transitions ="
      this.currentLine = startIdx + 1;
      this.parseTransitionLine(inlineMatch[1]);
    }
    
    i = startIdx + 1;
    
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
      
      this.parseTransitionLine(line);
      i++;
    }
    
    return i;
  }

  private parseTransitionLine(line: string): void {
    // Match state number at start: "1: ..." or "1. ..."
    const match = line.match(/(\d+)[:\.]?\s*(.+)/);
    if (!match) {
      throw new FSMValidationError(this.currentLine, `Invalid transition format: '${line}'`);
    }
    
    const state = parseInt(match[1], 10);
    const transitionsStr = match[2];
    
    const transitions: [string, string][] = [];
    
    // Try new format first: on '0' move '1', on '1' move '2'
    // Pattern: on 'symbol' move 'target' (case-insensitive, handles typos like "mocve")
    // Also handles period after symbol quote like: on '1'. Move '1'
    const newFormatPattern = /on\s*['"](\d+)['"]\.?\s*m\w*\s*['"](\d+)['"]\.?/gi;
    let newFormatMatch;
    
    while ((newFormatMatch = newFormatPattern.exec(transitionsStr)) !== null) {
      const symbol = newFormatMatch[1];
      const target = newFormatMatch[2];
      transitions.push([symbol, target]);
    }
    
    // If new format didn't match, try old format: 0.1, 1.2
    if (transitions.length === 0) {
      for (const trans of transitionsStr.split(',')) {
        const trimmed = trans.trim();
        if (trimmed.includes('.')) {
          const parts = trimmed.split('.');
          if (parts.length === 2 && /^\d+$/.test(parts[0].trim()) && /^\d+$/.test(parts[1].trim())) {
            transitions.push([parts[0].trim(), parts[1].trim()]);
          }
        }
      }
    }
    
    if (transitions.length === 0) {
      throw new FSMValidationError(this.currentLine, `No valid transitions found in: '${line}'`);
    }
    
    this.data.transitions[state] = transitions;
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

  /**
   * Detect indexing scheme and normalize a common "shifted" format:
   * - states is a COUNT (N)
   * - transition rows are labeled 1..N
   * - but transition targets are 0..N-1
   * In that case we normalize row labels (and start/accept) by -1 and treat as 0-based.
   */
  private detectAndNormalizeIndexingScheme(): void {
    const transitionStates = Object.keys(this.data.transitions).map(k => parseInt(k, 10));
    if (transitionStates.length === 0) {
      this.data.zeroIndexed = false;
      return;
    }

    const numStates = this.data.states ?? 0;
    const minFrom = Math.min(...transitionStates);
    const maxFrom = Math.max(...transitionStates);

    // Gather all target states
    const targetStates: number[] = [];
    for (const transitions of Object.values(this.data.transitions)) {
      for (const [, targetStr] of transitions) {
        const t = parseInt(targetStr, 10);
        if (!Number.isNaN(t)) targetStates.push(t);
      }
    }
    const minTo = targetStates.length ? Math.min(...targetStates) : Number.POSITIVE_INFINITY;
    const maxTo = targetStates.length ? Math.max(...targetStates) : Number.NEGATIVE_INFINITY;

    // Case A: explicit 0-based (row 0 exists)
    if (transitionStates.includes(0)) {
      this.data.zeroIndexed = true;
      return;
    }

    // Case B: shifted-from-states normalization (1..N rows, 0..N-1 targets)
    const looksShifted =
      numStates > 0 &&
      minFrom === 1 &&
      maxFrom === numStates &&
      minTo === 0 &&
      maxTo === numStates - 1;

    if (looksShifted) {
      const normalized: Record<number, [string, string][]> = {};
      for (const [fromStr, transitions] of Object.entries(this.data.transitions)) {
        const from = parseInt(fromStr, 10);
        normalized[from - 1] = transitions;
      }
      this.data.transitions = normalized;
      // Start/accept were authored in the same label space as the row labels
      if (this.data.startstate !== null) this.data.startstate = this.data.startstate - 1;
      if (this.data.acceptstate !== null) this.data.acceptstate = this.data.acceptstate - 1;
      this.data.zeroIndexed = true;
      return;
    }

    // Default: 1-based
    this.data.zeroIndexed = false;
  }

  private validateRules(): void {
    const missing = FSMParser.REQUIRED_FIELDS.filter(field => !this.fieldsFound.has(field));
    if (missing.length > 0) {
      throw new FSMValidationError(0, `Missing required fields: ${missing.join(', ')}`);
    }
    
    const numStates = this.data.states!;
    const transitionStates = Object.keys(this.data.transitions).map(k => parseInt(k, 10));
    const numTransitions = transitionStates.length;
    
    // Determine expected states based on indexing scheme
    const zeroIndexed = this.data.zeroIndexed;
    const expectedStates = zeroIndexed 
      ? Array.from({ length: numStates }, (_, i) => i) // 0..states-1
      : Array.from({ length: numStates }, (_, i) => i + 1); // 1..states
    
    const expectedCount = expectedStates.length;
    
    if (numTransitions !== expectedCount) {
      throw new FSMValidationError(0, 
        `Number of transitions (${numTransitions}) must equal number of states (${expectedCount}). ` +
        `Using ${zeroIndexed ? '0-based' : '1-based'} indexing. Expected states: ${expectedStates.join(', ')}`
      );
    }
    
    // Check all expected states have transitions
    for (const stateNum of expectedStates) {
      if (!(stateNum in this.data.transitions)) {
        throw new FSMValidationError(0, `State ${stateNum} has no transitions defined`);
      }
    }
    
    // Validate start and accept states are within valid range
    const minState = zeroIndexed ? 0 : 1;
    const maxState = zeroIndexed ? numStates - 1 : numStates;
    
    if (this.data.startstate! < minState || this.data.startstate! > maxState) {
      throw new FSMValidationError(0, 
        `Start state ${this.data.startstate} is invalid. Must be between ${minState} and ${maxState}`
      );
    }
    
    if (this.data.acceptstate! < minState || this.data.acceptstate! > maxState) {
      throw new FSMValidationError(0, 
        `Accept state ${this.data.acceptstate} is invalid. Must be between ${minState} and ${maxState}`
      );
    }
    
    // Validate each state has correct number of transitions (one per symbol)
    const numSymbols = this.data.symbols!.length;
    for (const [state, transitions] of Object.entries(this.data.transitions)) {
      if (transitions.length !== numSymbols) {
        throw new FSMValidationError(0, `State ${state} has ${transitions.length} transitions but ${numSymbols} symbols defined`);
      }
    }
    
    // Validate all transition targets are valid states
    for (const [state, transitions] of Object.entries(this.data.transitions)) {
      for (const [symbol, targetStr] of transitions) {
        const target = parseInt(targetStr, 10);
        if (target < minState || target > maxState) {
          throw new FSMValidationError(0, 
            `State ${state}: transition on '${symbol}' goes to invalid state ${target}. Must be between ${minState} and ${maxState}`
          );
        }
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
  // Build transition map: key = "state,symbol" -> nextState
  const transitionMap: Record<string, number> = {};
  for (const [state, transitionList] of Object.entries(fsm.transitions)) {
    for (const [inputSymbol, nextState] of transitionList) {
      const key = `${state},${inputSymbol}`;
      transitionMap[key] = parseInt(nextState, 10);
    }
  }
  
  let currentState = fsm.startstate;
  const path: { state: number; symbol?: string }[] = [{ state: currentState }];
  
  for (const symbol of input) {
    const key = `${currentState},${symbol}`;
    
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
