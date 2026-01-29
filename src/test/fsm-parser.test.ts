import { describe, it, expect } from 'vitest';
import { parseFSMFile, runFSM } from '@/lib/fsm-parser';

describe('FSM Parser - 1-based indexing', () => {
  // New readable format: on '0' move '1' means "on input 0, move to state 1"
  const userFile = `Name = "divby4fsm"
states = 4
symbols = {0, 1}
transitions =   1: on '0' Move '1', on '1' Move '1'
		2: on '0' move '2', on '1' Move '3'
		3. On '0' move '1', on '1' move '1'
		4. On '0' move '2', on '1' move '3'
		
startstate = 1
acceptstate = 1`;

  it('should parse the user file correctly', () => {
    const fsm = parseFSMFile(userFile);
    
    expect(fsm.name).toBe('divby4fsm');
    expect(fsm.states).toBe(4);
    expect(fsm.symbols).toEqual(['0', '1']);
    expect(fsm.startstate).toBe(1);
    expect(fsm.acceptstate).toBe(1);
    expect(fsm.zeroIndexed).toBe(false); // Should be 1-based
  });

  it('should have correct transitions for all 4 states', () => {
    const fsm = parseFSMFile(userFile);
    
    // State 1: on 0 → 1, on 1 → 1
    expect(fsm.transitions[1]).toEqual([['0', '1'], ['1', '1']]);
    // State 2: on 0 → 2, on 1 → 3
    expect(fsm.transitions[2]).toEqual([['0', '2'], ['1', '3']]);
    // State 3: on 0 → 1, on 1 → 1
    expect(fsm.transitions[3]).toEqual([['0', '1'], ['1', '1']]);
    // State 4: on 0 → 2, on 1 → 3
    expect(fsm.transitions[4]).toEqual([['0', '2'], ['1', '3']]);
  });

  it('should run FSM correctly with input 0101', () => {
    const fsm = parseFSMFile(userFile);
    const result = runFSM(fsm, '0101');
    
    // Start at 1, input 0 → 1, input 1 → 1, input 0 → 1, input 1 → 1
    expect(result.path.map(p => p.state)).toEqual([1, 1, 1, 1, 1]);
    expect(result.accepted).toBe(true);
    expect(result.endState).toBe(1);
  });
});
