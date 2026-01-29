/**
 * Excel Generator for FSM Experiments
 * Generates a .xlsx file with Experiment_Layout and Reagents_and_Tiles sheets
 */

import * as XLSX from 'xlsx';
import { FSMData, runFSM } from './fsm-parser';

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
 * Generate all competing tiles based on FSM transitions
 * For each state, include all possible transition tiles
 */
function generateCompetingTiles(fsmData: FSMData): string[] {
  const tiles: string[] = [];
  const stateLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  // For each state, generate tiles for all transitions
  for (let state = 1; state <= fsmData.states; state++) {
    const stateTransitions = fsmData.transitions[state];
    if (stateTransitions) {
      const currentStateLabel = stateLabels[state - 1] || `S${state}`;
      for (const [symbol, nextState] of stateTransitions) {
        const nextStateNum = parseInt(nextState, 10);
        // Format: <symbol><currentStateLabel><nextStateNum>
        // e.g., 0B1 means: input 0, from state B, goes to state 1
        tiles.push(`${symbol}${currentStateLabel}${nextStateNum}*`);
      }
    }
  }

  // For final state D (state 4), include 0D, 1D, 2D, 3D
  tiles.push('0D', '1D', '2D', '3D');

  return [...new Set(tiles)];
}

/**
 * Get the correct tiles for a specific FSM input (for control columns)
 * Returns only the tiles that would be traversed for the given input
 */
function getCorrectTiles(fsmData: FSMData, input: string): string[] {
  const tiles: string[] = ['A1*']; // Always starts with A1
  const stateLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  let currentState = fsmData.startstate;

  for (const symbol of input) {
    const transitions = fsmData.transitions[currentState];
    if (transitions) {
      for (const [transSymbol, nextState] of transitions) {
        if (transSymbol === symbol) {
          const currentLabel = stateLabels[currentState - 1] || `S${currentState}`;
          const nextStateNum = parseInt(nextState, 10);
          tiles.push(`${symbol}${currentLabel}${nextStateNum}*`);
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

  // Generate Sheet 1: Experiment_Layout
  const sheet1 = generateExperimentLayoutSheet(params);
  XLSX.utils.book_append_sheet(wb, sheet1, 'Experiment_Layout');

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
 */
function generateReagentsAndTilesSheet(
  params: ExcelGenerationParams,
  fsmData: FSMData
): XLSX.WorkSheet {
  const { experiments, stockConcentration, targetConcentration, totalVolume } = params;
  const data: (string | number | null)[][] = [];

  // Get competing tiles from FSM
  const competingTiles = generateCompetingTiles(fsmData);

  // Build all tiles list - A1* first, then competing tiles
  const allTiles = ['A1*', ...competingTiles.filter(t => t !== 'A1*')];

  // For each experiment, we create two column groups: Experiment and Repeat Experiment
  // Each group has columns: Species, Stock Conc, Target Conc, Volume to Move, Exact Num Droplets

  // Row 1: Empty row for spacing
  data.push([]);

  // Row 2: Group headers - "Experiment" and "Repeat Experiment"
  const groupHeaderRow: (string | null)[] = [];
  for (let i = 0; i < experiments.length; i++) {
    groupHeaderRow.push('Experiment', null, null, null, null);
    groupHeaderRow.push('Repeat Experiment', null, null, null, null);
  }
  data.push(groupHeaderRow);

  // Row 3: Experiment name row
  const expNameRow: (string | null)[] = [];
  for (let i = 0; i < experiments.length; i++) {
    const exp = experiments[i];
    expNameRow.push(`${exp.name}`, 'Stock Conc (uM)', 'Target conc (uM)', 'Volume to move (nL)', 'Exact num droplets');
    expNameRow.push(`${exp.name}`, 'Stock Conc (uM)', 'Target conc (uM)', 'Volume to move (nL)', 'Exact num droplets');
  }
  data.push(expNameRow);

  // Calculate values for each tile
  const defaultStock = stockConcentration || 50;

  // Add tile rows
  for (const tile of allTiles) {
    const row: (string | number)[] = [];

    for (let i = 0; i < experiments.length; i++) {
      const exp = experiments[i];
      const correctTiles = getCorrectTiles(fsmData, exp.fsmInput);

      // Experiment column - includes all tiles
      const volToMove = calculateVolumeToMove(targetConcentration, totalVolume, defaultStock);
      const droplets = calculateDroplets(volToMove);

      row.push(tile);
      row.push(defaultStock);
      row.push(targetConcentration);
      row.push(Math.round(volToMove * 100) / 100);
      row.push(Math.round(droplets * 1000) / 1000);

      // Repeat Experiment column - same values
      row.push(tile);
      row.push(defaultStock);
      row.push(targetConcentration);
      row.push(Math.round(volToMove * 100) / 100);
      row.push(Math.round(droplets * 1000) / 1000);
    }

    data.push(row);
  }

  // Add scaffold reagents
  for (const reagent of SCAFFOLD_REAGENTS) {
    const row: (string | number | null)[] = [];

    for (let i = 0; i < experiments.length; i++) {
      const stock = reagent.stockConcentration;
      const target = reagent.targetConcentration;

      if (target === null) {
        // N/A for target concentration
        row.push(reagent.name);
        row.push(stock);
        row.push('N/A');
        // Use fixed values for these reagents
        if (reagent.name === '10x MG++') {
          row.push(8);
          row.push(0.32);
        } else {
          const vol = calculateVolumeToMove(1, totalVolume, stock);
          row.push(Math.round(vol * 100000000) / 100000000);
          row.push(Math.round(calculateDroplets(vol) * 1000000000) / 1000000000);
        }
      } else {
        const vol = calculateVolumeToMove(target, totalVolume, stock);
        const drops = calculateDroplets(vol);
        row.push(reagent.name);
        row.push(stock);
        row.push(target);
        row.push(Math.round(vol * 100000000) / 100000000);
        row.push(Math.round(drops * 100000000) / 100000000);
      }

      // Repeat Experiment column - same structure
      if (target === null) {
        row.push(reagent.name);
        row.push(stock);
        row.push('N/A');
        if (reagent.name === '10x MG++') {
          row.push(3.5);
          row.push(0.14);
        } else {
          const vol = calculateVolumeToMove(1, totalVolume, stock);
          row.push(Math.round(vol * 100000000) / 100000000);
          row.push(Math.round(calculateDroplets(vol) * 1000000000) / 1000000000);
        }
      } else {
        const vol = calculateVolumeToMove(target, totalVolume, stock);
        const drops = calculateDroplets(vol);
        row.push(reagent.name);
        row.push(stock);
        row.push(target);
        row.push(Math.round(vol * 100000000) / 100000000);
        row.push(Math.round(drops * 100000000) / 100000000);
      }
    }

    data.push(row);
  }

  // Add Total row
  const totalRow: (string | number)[] = [];
  for (let i = 0; i < experiments.length; i++) {
    // Calculate total target concentration for experiment
    const tileCount = allTiles.length;
    const reagentTotal = SCAFFOLD_REAGENTS.reduce((sum, r) => sum + (r.targetConcentration || 0), 0);
    const tileTotal = tileCount * targetConcentration;
    const total = tileTotal + reagentTotal;

    totalRow.push('Total');
    totalRow.push('');
    totalRow.push('');
    totalRow.push(Math.round(total * 100) / 100);
    totalRow.push('');

    // Repeat column
    totalRow.push('Total');
    totalRow.push('');
    totalRow.push('');
    totalRow.push(Math.round(total * 100) / 100);
    totalRow.push('');
  }
  data.push(totalRow);

  // Add Buffer section
  data.push([]);
  data.push([]);

  const bufferHeaderRow: (string | null)[] = [];
  for (let i = 0; i < experiments.length; i++) {
    bufferHeaderRow.push('Buffer', null, null, null, null);
    bufferHeaderRow.push('Buffer', null, null, null, null);
  }
  data.push(bufferHeaderRow);

  const bufferColHeaders: string[] = [];
  for (let i = 0; i < experiments.length; i++) {
    bufferColHeaders.push('Species', 'Stock conc (nM)', 'Target conc (nM)', 'Volume to move (nL)', 'Exact num droplets');
    bufferColHeaders.push('Species', 'Stock conc (nM)', 'Target conc (nM)', 'Volume to move (nL)', 'Exact num droplets');
  }
  data.push(bufferColHeaders);

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  const numCols = experiments.length * 10;
  const colWidths: { wch: number }[] = [];
  for (let i = 0; i < numCols; i++) {
    const colType = i % 5;
    if (colType === 0) {
      colWidths.push({ wch: 22 }); // Species/Tile name
    } else {
      colWidths.push({ wch: 18 }); // Other columns
    }
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
