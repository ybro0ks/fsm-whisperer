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
 * Layout: Vertical sections for Buffer, then each experiment
 * Each section has two side-by-side blocks (Experiment + Repeat)
 */
function generateReagentsAndTilesSheet(
  params: ExcelGenerationParams,
  fsmData: FSMData
): XLSX.WorkSheet {
  const { experiments, totalVolume } = params;
  const data: (string | number | null)[][] = [];

  // ---- Buffer Section ----
  // Header row
  const bufferHeader: (string | null)[] = ['Buffer', null, null, null, null, null, 'Buffer', null, null, null, null];
  data.push(bufferHeader);

  // Column headers
  const colHeaders = ['Species', 'Stock conc', 'Target conc', 'Volume', 'Exact num droplets'];
  data.push([...colHeaders, null, ...colHeaders]);

  // Buffer reagents: 0.1x tween and 1x TAE
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

  // Buffer total
  const bufferTotal = bufferReagents.reduce((sum, r) => sum + r.volume, 0);
  data.push(['Total', null, null, bufferTotal, null, null, 'Total', null, null, bufferTotal, null]);

  // Spacer
  data.push([]);
  data.push([]);

  // ---- Experiment Sections ----
  for (const exp of experiments) {
    const sectionName = `${exp.name}; ${exp.fluorophore}`;

    // Section header
    data.push([sectionName, null, null, null, null, null, sectionName, null, null, null, null]);

    // Column headers
    data.push([...colHeaders, null, ...colHeaders]);

    // Experiment-specific reagent: 5RF 10uM
    const fiveRF = {
      name: '5RF 10uM',
      stock: 10,
      target: 0.07857,
      volume: 275,
      droplets: 11,
    };

    data.push([
      fiveRF.name, fiveRF.stock, fiveRF.target, fiveRF.volume, fiveRF.droplets,
      null,
      fiveRF.name, fiveRF.stock, fiveRF.target, fiveRF.volume, fiveRF.droplets,
    ]);

    // Same buffer reagents
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

    // Experiment total
    const expTotal = fiveRF.volume + expBufferReagents.reduce((sum, r) => sum + r.volume, 0);
    data.push(['Total', null, null, totalVolume || expTotal, null, null, 'Total', null, null, totalVolume || expTotal, null]);

    // Spacer between experiments
    data.push([]);
    data.push([]);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 18 },
    { wch: 4 },  // spacer column
    { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 18 },
  ];

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
