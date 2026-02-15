/**
 * Excel Generator for FSM Experiments
 * Generates a .xlsx file with Experiment_Layout and Reagents_and_Tiles sheets
 */

import * as XLSX from 'xlsx';
import { FSMData, runFSM } from './fsm-parser';
import { generateFSMSteps } from './fsm-step-generator';

export interface ExperimentInput {
  name: string;
  fsmInput: string;
  result: 'ACCEPT' | 'REJECT';
  finalState: number;
  fluorophore: string;
}

export interface ExcelGenerationParams {
  experiments: ExperimentInput[];
  bufferName: string;
  stockConcentration: number;
  targetConcentration: number;
  totalVolume: number;
}

// Reagent configurations with default stock concentrations
interface ReagentConfig {
  name: string;
  stockConcentration: number;
  targetConcentration: number | null; // null means N/A
}

const SCAFFOLD_REAGENTS: ReagentConfig[] = [
  { name: 'Scaffold 10uM', stockConcentration: 5.38, targetConcentration: 0.1 },
  { name: 'ATTO*E 10um', stockConcentration: 9.574934268, targetConcentration: 0.09 },
  { name: '5RF', stockConcentration: 1.076957099, targetConcentration: 0.08 },
  { name: '3RQ', stockConcentration: 11.91891832, targetConcentration: 1.7 },
  { name: '10x MG++', stockConcentration: 50, targetConcentration: null },
  { name: '0.01% Tween in 1x TAE', stockConcentration: 50, targetConcentration: null },
];

/**
 * Run FSM and return ACCEPT or REJECT plus the final state
 */
export function evaluateFSM(fsmData: FSMData, input: string): { result: 'ACCEPT' | 'REJECT'; finalState: number } {
  const runResult = runFSM(fsmData, input);
  return {
    result: runResult.accepted ? 'ACCEPT' : 'REJECT',
    finalState: runResult.endState,
  };
}

/**
 * Generate competing tiles from FSM steps for a specific input.
 * Uses the step generator logic: anchor has one tile, other positions show all competing states.
 * Format: A<toState> for anchor, <fromState><posLabel><toState> for middle, <fromState><posLabel> for final.
 */
function generateCompetingTilesFromSteps(fsmData: FSMData, input: string): string[][] {
  const positionLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const steps = generateFSMSteps(fsmData, input);
  const result: string[][] = [];

  for (const step of steps.steps) {
    const posLabel = positionLabels[step.position];
    const isFinal = step.position === steps.steps.length - 1;
    const tiles: string[] = [];

    for (const state of step.states) {
      if (step.isAnchor) {
        // Anchor: A<nextState>
        if (state.nextState !== null) {
          tiles.push(`${posLabel}${state.nextState}`);
        }
      } else if (isFinal) {
        // Final position: <fromState><posLabel>
        tiles.push(`${state.currentState}${posLabel}`);
      } else {
        // Middle: <fromState><posLabel><toState>
        if (state.nextState !== null) {
          tiles.push(`${state.currentState}${posLabel}${state.nextState}`);
        }
      }
    }

    result.push(tiles);
  }

  return result;
}

/**
 * Get the correct tiles for a specific FSM input (control column)
 * Anchor: A<toState>, Middle: <fromState><posLabel><toState>, Final: <fromState><posLabel>
 */
function getCorrectTiles(fsmData: FSMData, input: string): string[] {
  const positionLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const tiles: string[] = [];

  let currentState = fsmData.startstate;

  for (let pos = 0; pos < input.length; pos++) {
    const symbol = input[pos];
    const transitions = fsmData.transitions[currentState];
    if (transitions) {
      for (const [transSymbol, nextState] of transitions) {
        if (transSymbol === symbol) {
          const nextStateNum = parseInt(nextState, 10);

          if (pos === 0) {
            // Anchor: A<toState>
            tiles.push(`A${nextStateNum}`);
          } else {
            const posLabel = positionLabels[pos];
            if (pos === input.length - 1) {
              tiles.push(`${currentState}${posLabel}`);
            } else {
              tiles.push(`${currentState}${posLabel}${nextStateNum}`);
            }
          }

          currentState = nextStateNum;
          break;
        }
      }
    }
  }

  return tiles;
}

/**
 * Calculate volume to move
 */
function calculateVolumeToMove(
  targetConcentration: number,
  totalVolume: number,
  stockConcentration: number
): number {
  return (targetConcentration * totalVolume) / stockConcentration;
}

/**
 * Calculate exact number of droplets
 */
function calculateDroplets(volumeToMove: number): number {
  return volumeToMove / 25;
}

/**
 * Apply cell styling (green background for headers)
 */
function applyCellStyle(ws: XLSX.WorkSheet, cellRef: string, style: 'green' | 'orange' | 'red' | 'bold'): void {
  if (!ws[cellRef]) return;

  // Note: xlsx library has limited styling in the free version
  // For full styling, xlsx-style or similar would be needed
  // We'll add comments to indicate intended styling
  const cell = ws[cellRef];
  if (!cell.c) cell.c = [];

  const styleComments: Record<string, string> = {
    green: 'Background: Green',
    orange: 'Background: Orange',
    red: 'Background: Red',
    bold: 'Font: Bold',
  };

  cell.c.push({ t: styleComments[style] || '' });
}

/**
 * Generate the Excel workbook with two sheets
 */
export function generateExcelWorkbook(
  params: ExcelGenerationParams,
  fsmData: FSMData
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Generate Sheet 1: qpcr_layout
  const sheet1 = generateExperimentLayoutSheet(params);
  XLSX.utils.book_append_sheet(wb, sheet1, 'qpcr_layout');

  // Generate Sheet 2: Reagents_and_Tiles
  const sheet2 = generateReagentsAndTilesSheet(params, fsmData);
  XLSX.utils.book_append_sheet(wb, sheet2, 'Reagents_and_Tiles');

  // Generate Metadata sheet
  const metadataSheet = generateMetadataSheet(params);
  XLSX.utils.book_append_sheet(wb, metadataSheet, '_Metadata');

  return wb;
}

/**
 * Generate Experiment_Layout sheet
 */
function generateExperimentLayoutSheet(params: ExcelGenerationParams): XLSX.WorkSheet {
  const { experiments, bufferName } = params;
  const data: (string | number | null)[][] = [];

  // Row 1: Headers - Buffer, Buffer (Control), then alternating Experiment/Control
  const headerRow: string[] = ['Buffer', 'Buffer (Control)'];
  for (let i = 0; i < experiments.length; i++) {
    headerRow.push('Experiment');
    headerRow.push('Control');
  }
  data.push(headerRow);

  // Row 2: Buffer values and experiment names
  // Format: <Experiment Name>; Position <Final FSM State>; <Fluorophore>
  const valuesRow: string[] = [bufferName, bufferName];
  for (const exp of experiments) {
    const expName = `${exp.name}; Position ${exp.finalState}; ${exp.fluorophore}`;
    valuesRow.push(expName);
    valuesRow.push(expName); // Control has same name
  }
  data.push(valuesRow);

  // Row 3: Empty (reserved spacing)
  data.push(Array(headerRow.length).fill(''));

  // Row 4: Experiment results (ACCEPT / REJECT)
  const resultsRow: string[] = ['', ''];
  for (const exp of experiments) {
    resultsRow.push(exp.result);
    resultsRow.push(''); // Control has no result shown
  }
  data.push(resultsRow);

  // Rows 5-8: Empty spacing (4 rows)
  for (let i = 0; i < 4; i++) {
    data.push(Array(headerRow.length).fill(''));
  }

  // Row 9: qPCR Positioning header
  data.push(['QPCR Positioning']);

  // qPCR positioning values
  data.push(['Buffer']);
  data.push([bufferName]);

  for (let i = 0; i < experiments.length; i++) {
    const exp = experiments[i];
    const expName = `${exp.name}; Position ${exp.finalState}; ${exp.fluorophore}`;
    data.push([`Experiment ${i + 1}: ${expName}`]);
    data.push([`Control ${i + 1}: ${expName}`]);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  const colWidths = headerRow.map((_, idx) => ({ wch: idx < 2 ? 20 : 40 }));
  ws['!cols'] = colWidths;

  return ws;
}

/**
 * Generate Reagents_and_Tiles sheet
 * Top section: Original experiment tiles (Experiment + Repeat columns per experiment)
 * Bottom section: Buffer and experiment reagent blocks (side-by-side)
 */
function generateReagentsAndTilesSheet(
  params: ExcelGenerationParams,
  fsmData: FSMData
): XLSX.WorkSheet {
  const { experiments, stockConcentration, targetConcentration, totalVolume } = params;
  const data: (string | number | null)[][] = [];

  // Generate competing tiles per experiment using step generator logic (grouped by position)
  const competingTilesByPositionPerExp = experiments.map(exp => 
    generateCompetingTilesFromSteps(fsmData, exp.fsmInput)
  );
  const competingTilesPerExp = competingTilesByPositionPerExp.map(positions => positions.flat());
  // Get correct tiles per experiment for control columns
  const correctTilesPerExp = experiments.map(exp => getCorrectTiles(fsmData, exp.fsmInput));
  const defaultStock = stockConcentration || 50;

  // Find the max row count across all experiments
  const maxRows = Math.max(
    ...competingTilesPerExp.map(t => t.length),
    ...correctTilesPerExp.map(t => t.length)
  );

  // Row 1: Empty row for spacing
  data.push([]);

  // Row 2: Group headers
  const groupHeaderRow: (string | null)[] = [];
  for (let i = 0; i < experiments.length; i++) {
    groupHeaderRow.push('Experiment (Competing)', null, null, null, null);
    groupHeaderRow.push('Control (Correct Path)', null, null, null, null);
  }
  data.push(groupHeaderRow);

  // Row 3: Experiment name + column headers
  const expNameRow: (string | null)[] = [];
  for (let i = 0; i < experiments.length; i++) {
    const exp = experiments[i];
    expNameRow.push(`${exp.name}`, 'Stock Conc (uM)', 'Target conc (uM)', 'Volume to move (nL)', 'Exact num droplets');
    expNameRow.push(`${exp.name} (Control)`, 'Stock Conc (uM)', 'Target conc (uM)', 'Volume to move (nL)', 'Exact num droplets');
  }
  data.push(expNameRow);

  // Tile rows - experiment gets all competing tiles by position, control gets correct path
  for (let r = 0; r < maxRows; r++) {
    const row: (string | number | null)[] = [];
    for (let i = 0; i < experiments.length; i++) {
      const volToMove = calculateVolumeToMove(targetConcentration, totalVolume, defaultStock);
      const droplets = calculateDroplets(volToMove);

      // Experiment column: competing tile for this experiment
      const expTiles = competingTilesPerExp[i];
      const competingTile = r < expTiles.length ? expTiles[r] : null;
      if (competingTile) {
        row.push(competingTile, defaultStock, targetConcentration, Math.round(volToMove * 100) / 100, Math.round(droplets * 1000) / 1000);
      } else {
        row.push(null, null, null, null, null);
      }

      // Control column: correct path tile
      const correctTile = r < correctTilesPerExp[i].length ? correctTilesPerExp[i][r] : null;
      if (correctTile) {
        row.push(correctTile, defaultStock, targetConcentration, Math.round(volToMove * 100) / 100, Math.round(droplets * 1000) / 1000);
      } else {
        row.push(null, null, null, null, null);
      }
    }
    data.push(row);
  }

  // Scaffold reagent rows
  for (const reagent of SCAFFOLD_REAGENTS) {
    const row: (string | number | null)[] = [];
    for (let i = 0; i < experiments.length; i++) {
      // Two passes: experiment + control
      for (let pass = 0; pass < 2; pass++) {
        const stock = reagent.stockConcentration;
        const target = reagent.targetConcentration;
        if (target === null) {
          row.push(reagent.name, stock, 'N/A');
          if (reagent.name === '10x MG++') {
            row.push(pass === 0 ? 8 : 3.5, pass === 0 ? 0.32 : 0.14);
          } else {
            const vol = calculateVolumeToMove(1, totalVolume, stock);
            row.push(Math.round(vol * 1e8) / 1e8, Math.round(calculateDroplets(vol) * 1e9) / 1e9);
          }
        } else {
          const vol = calculateVolumeToMove(target, totalVolume, stock);
          const drops = calculateDroplets(vol);
          row.push(reagent.name, stock, target, Math.round(vol * 1e8) / 1e8, Math.round(drops * 1e8) / 1e8);
        }
      }
    }
    data.push(row);
  }

  // Total row
  const totalRow: (string | number)[] = [];
  for (let i = 0; i < experiments.length; i++) {
    const tileCount = competingTilesPerExp[i].length;
    const reagentTotal = SCAFFOLD_REAGENTS.reduce((sum, r) => sum + (r.targetConcentration || 0), 0);
    const tileTotal = tileCount * targetConcentration;
    const total = tileTotal + reagentTotal;
    totalRow.push('Total', '', '', Math.round(total * 100) / 100, '');
    totalRow.push('Total', '', '', Math.round(total * 100) / 100, '');
  }
  data.push(totalRow);

  // ===== SPACER =====
  data.push([]);
  data.push([]);
  data.push([]);

  // ===== BOTTOM SECTION: Buffer & Experiment Reagent Blocks =====
  const colHeaders = ['Species', 'Stock conc', 'Target conc', 'Volume', 'Exact num droplets'];

  // ---- Buffer Section ----
  data.push(['Buffer', null, null, null, null, null, 'Buffer', null, null, null, null]);
  data.push([...colHeaders, null, ...colHeaders]);

  const bufferReagents = [
    { name: '0.1x tween', stock: 'N/A', target: 'N/A', volume: 3500, droplets: 140 },
    { name: '1x TAE', stock: 'N/A', target: 'N/A', volume: 31500, droplets: 1260 },
  ];
  for (const reagent of bufferReagents) {
    data.push([
      reagent.name, reagent.stock, reagent.target, reagent.volume, reagent.droplets,
      null,
      reagent.name, reagent.stock, reagent.target, reagent.volume, reagent.droplets,
    ]);
  }
  const bufferTotal = bufferReagents.reduce((sum, r) => sum + r.volume, 0);
  data.push(['Total', null, null, bufferTotal, null, null, 'Total', null, null, bufferTotal, null]);

  data.push([]);
  data.push([]);

  // ---- Experiment Reagent Sections ----
  for (const exp of experiments) {
    const sectionName = `${exp.name}; ${exp.fluorophore}`;
    data.push([sectionName, null, null, null, null, null, sectionName, null, null, null, null]);
    data.push([...colHeaders, null, ...colHeaders]);

    const fiveRF = { name: '5RF 10uM', stock: 10, target: 0.07857, volume: 275, droplets: 11 };
    data.push([
      fiveRF.name, fiveRF.stock, fiveRF.target, fiveRF.volume, fiveRF.droplets,
      null,
      fiveRF.name, fiveRF.stock, fiveRF.target, fiveRF.volume, fiveRF.droplets,
    ]);

    const expBufferReagents = [
      { name: '0.1x tween', stock: 'N/A', target: 'N/A', volume: 3500, droplets: 140 },
      { name: '1x TAE', stock: 'N/A', target: 'N/A', volume: 31500, droplets: 1249 },
    ];
    for (const reagent of expBufferReagents) {
      data.push([
        reagent.name, reagent.stock, reagent.target, reagent.volume, reagent.droplets,
        null,
        reagent.name, reagent.stock, reagent.target, reagent.volume, reagent.droplets,
      ]);
    }

    const expTotal = fiveRF.volume + expBufferReagents.reduce((sum, r) => sum + r.volume, 0);
    data.push(['Total', null, null, totalVolume || expTotal, null, null, 'Total', null, null, totalVolume || expTotal, null]);
    data.push([]);
    data.push([]);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths based on the wider top section
  const numCols = experiments.length * 10;
  const colWidths: { wch: number }[] = [];
  for (let i = 0; i < Math.max(numCols, 11); i++) {
    const colType = i % 5;
    colWidths.push({ wch: colType === 0 ? 22 : 18 });
  }
  ws['!cols'] = colWidths;

  return ws;
}

/**
 * Generate Metadata sheet
 */
function generateMetadataSheet(params: ExcelGenerationParams): XLSX.WorkSheet {
  const { experiments, bufferName, stockConcentration, targetConcentration, totalVolume } = params;

  const data: (string | number)[][] = [
    ['Property', 'Value'],
    ['Timestamp', new Date().toISOString()],
    ['Number of Experiments', experiments.length],
    ['Buffer Name', bufferName],
    ['Stock Concentration', stockConcentration],
    ['Target Concentration', targetConcentration],
    ['Total Volume', totalVolume],
  ];

  // Add experiment details
  data.push(['', '']);
  data.push(['Experiment Details', '']);

  for (let i = 0; i < experiments.length; i++) {
    const exp = experiments[i];
    data.push([`Experiment ${i + 1}`, exp.name]);
    data.push(['  FSM Input', exp.fsmInput]);
    data.push(['  Result', exp.result]);
    data.push(['  Final State', exp.finalState]);
    data.push(['  Fluorophore', exp.fluorophore]);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 25 }, { wch: 40 }];

  return ws;
}

/**
 * Download the workbook as an Excel file
 */
export function downloadExcel(wb: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(wb, filename);
}

/**
 * Generate filename with timestamp
 */
export function generateFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `experiment_${timestamp}.xlsx`;
}
