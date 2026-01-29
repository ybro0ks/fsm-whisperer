import { FSMData } from '@/lib/fsm-parser';

interface FSMVisualizerProps {
  fsm: FSMData;
  currentState?: number;
  highlightedTransition?: { from: number; symbol: string };
}

export default function FSMVisualizer({ fsm, currentState, highlightedTransition }: FSMVisualizerProps) {
  const width = 600;
  const height = 400;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 130;
  const stateRadius = 30;

  // Calculate state positions in a circle
  // Support both 0-based and 1-based indexing
  const statePositions: Record<number, { x: number; y: number }> = {};
  // fsm.states is a COUNT. If zeroIndexed, states are 0..states-1. If 1-based, 1..states.
  const numStates = fsm.states;
  const startIndex = fsm.zeroIndexed ? 0 : 1;
  
  for (let i = 0; i < numStates; i++) {
    const stateNum = startIndex + i;
    const angle = (2 * Math.PI * i / numStates) - (Math.PI / 2);
    statePositions[stateNum] = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  }

  // Group transitions by from-to pair for label stacking
  const transitionGroups: Record<string, { from: number; to: number; symbols: string[] }> = {};
  for (const [stateStr, transitions] of Object.entries(fsm.transitions)) {
    const state = parseInt(stateStr, 10);
    for (const [symbol, nextStateStr] of transitions) {
      const nextState = parseInt(nextStateStr, 10);
      const key = `${state}-${nextState}`;
      if (!transitionGroups[key]) {
        transitionGroups[key] = { from: state, to: nextState, symbols: [] };
      }
      transitionGroups[key].symbols.push(symbol);
    }
  }

  const getStateColor = (stateNum: number) => {
    if (currentState === stateNum) {
      return 'hsl(var(--state-current))';
    }
    if (stateNum === fsm.startstate && stateNum === fsm.acceptstate) {
      return 'hsl(var(--state-accept))';
    }
    if (stateNum === fsm.startstate) {
      return 'hsl(var(--state-start))';
    }
    if (stateNum === fsm.acceptstate) {
      return 'hsl(var(--state-accept))';
    }
    return 'hsl(var(--state-default))';
  };

  const isTransitionHighlighted = (from: number, symbol: string) => {
    return highlightedTransition?.from === from && highlightedTransition?.symbol === symbol;
  };

  const renderSelfLoop = (state: number, symbols: string[]) => {
    const pos = statePositions[state];
    const loopRadius = 25;
    const loopY = pos.y - stateRadius - loopRadius;
    const isHighlighted = symbols.some(s => isTransitionHighlighted(state, s));

    return (
      <g key={`loop-${state}`}>
        <ellipse
          cx={pos.x}
          cy={loopY}
          rx={loopRadius}
          ry={loopRadius * 0.6}
          fill="none"
          stroke={isHighlighted ? 'hsl(var(--transition-active))' : 'hsl(var(--transition-line))'}
          strokeWidth={isHighlighted ? 3 : 2}
        />
        {/* Arrow head */}
        <polygon
          points={`${pos.x + 8},${loopY + loopRadius * 0.6 - 2} ${pos.x + 15},${loopY + loopRadius * 0.6 + 5} ${pos.x + 3},${loopY + loopRadius * 0.6 + 5}`}
          fill={isHighlighted ? 'hsl(var(--transition-active))' : 'hsl(var(--transition-line))'}
        />
        <text
          x={pos.x}
          y={loopY - loopRadius * 0.6 - 8}
          textAnchor="middle"
          className="fill-foreground font-mono text-sm font-medium"
        >
          {symbols.join(', ')}
        </text>
      </g>
    );
  };

  const renderTransition = (from: number, to: number, symbols: string[]) => {
    if (from === to) {
      return renderSelfLoop(from, symbols);
    }

    const fromPos = statePositions[from];
    const toPos = statePositions[to];

    // Calculate direction vector
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const ndx = dx / dist;
    const ndy = dy / dist;

    // Offset start and end by state radius
    const startX = fromPos.x + ndx * stateRadius;
    const startY = fromPos.y + ndy * stateRadius;
    const endX = toPos.x - ndx * (stateRadius + 8);
    const endY = toPos.y - ndy * (stateRadius + 8);

    // Check if there's a reverse transition
    const reverseKey = `${to}-${from}`;
    const hasReverse = reverseKey in transitionGroups;
    
    // Curve offset for bidirectional arrows
    const curveOffset = hasReverse ? 20 : 0;
    const perpX = -ndy * curveOffset;
    const perpY = ndx * curveOffset;

    const midX = (startX + endX) / 2 + perpX;
    const midY = (startY + endY) / 2 + perpY;

    const isHighlighted = symbols.some(s => isTransitionHighlighted(from, s));

    const pathD = hasReverse
      ? `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`
      : `M ${startX} ${startY} L ${endX} ${endY}`;

    // Calculate label position
    const labelX = hasReverse ? midX : (startX + endX) / 2;
    const labelY = hasReverse ? midY - 12 : (startY + endY) / 2 - 12;

    return (
      <g key={`trans-${from}-${to}`}>
        <path
          d={pathD}
          fill="none"
          stroke={isHighlighted ? 'hsl(var(--transition-active))' : 'hsl(var(--transition-line))'}
          strokeWidth={isHighlighted ? 3 : 2}
          markerEnd={isHighlighted ? 'url(#arrowhead-active)' : 'url(#arrowhead)'}
        />
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          className="fill-primary font-mono text-sm font-bold"
        >
          {symbols.join(', ')}
        </text>
      </g>
    );
  };

  return (
    <svg width={width} height={height} className="bg-card rounded-lg border">
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            fill="hsl(var(--transition-line))"
          />
        </marker>
        <marker
          id="arrowhead-active"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            fill="hsl(var(--transition-active))"
          />
        </marker>
      </defs>

      {/* Render transitions first (behind states) */}
      {Object.values(transitionGroups).map(({ from, to, symbols }) =>
        renderTransition(from, to, symbols)
      )}

      {/* Start arrow */}
      {fsm.startstate && (
        <g>
          <line
            x1={statePositions[fsm.startstate].x - stateRadius - 40}
            y1={statePositions[fsm.startstate].y}
            x2={statePositions[fsm.startstate].x - stateRadius - 5}
            y2={statePositions[fsm.startstate].y}
            stroke="hsl(var(--state-start))"
            strokeWidth={2}
            markerEnd="url(#arrowhead-start)"
          />
          <marker
            id="arrowhead-start"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="hsl(var(--state-start))"
            />
          </marker>
        </g>
      )}

      {/* Render states */}
      {Object.entries(statePositions).map(([stateStr, pos]) => {
        const stateNum = parseInt(stateStr, 10);
        const isAccept = stateNum === fsm.acceptstate;
        const isCurrent = currentState === stateNum;

        return (
          <g key={stateNum}>
            {/* Outer circle for accept state */}
            {isAccept && (
              <circle
                cx={pos.x}
                cy={pos.y}
                r={stateRadius + 5}
                fill="none"
                stroke={getStateColor(stateNum)}
                strokeWidth={2}
              />
            )}
            {/* Main state circle */}
            <circle
              cx={pos.x}
              cy={pos.y}
              r={stateRadius}
              fill={getStateColor(stateNum)}
              stroke={isCurrent ? 'hsl(var(--state-current))' : 'hsl(var(--border))'}
              strokeWidth={isCurrent ? 3 : 2}
              className={isCurrent ? 'animate-pulse-glow' : ''}
            />
            {/* State label */}
            <text
              x={pos.x}
              y={pos.y + 5}
              textAnchor="middle"
              className="fill-foreground font-mono text-base font-bold"
            >
              q{stateNum}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <g transform="translate(10, 360)">
        <circle cx="8" cy="8" r="6" fill="hsl(var(--state-start))" />
        <text x="20" y="12" className="fill-muted-foreground text-xs">Start</text>
        <circle cx="60" cy="8" r="6" fill="hsl(var(--state-accept))" />
        <text x="72" y="12" className="fill-muted-foreground text-xs">Accept</text>
        <circle cx="120" cy="8" r="6" fill="hsl(var(--state-current))" />
        <text x="132" y="12" className="fill-muted-foreground text-xs">Current</text>
      </g>
    </svg>
  );
}
