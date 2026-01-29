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
}

export interface ExcelGenerationParams {
  experiments: ExperimentInput[];
  bufferName: string;
  stockConcentration: number;
  targetConcentration: number;
  totalVolume: number;
}

interface CellStyle {
  bold?: boolean;
}

/**
 * Run FSM and return ACCEPT or REJECT
 */
export function evaluateFSM(fsmData: FSMData, input: string): 'ACCEPT' | 'REJECT' {
  const result = runFSM(fsmData, input);
  return result.accepted ? 'ACCEPT' : 'REJECT';
}

/**
 * Generate competing tiles based on FSM transitions
 * For states A → C: Include all possible next tiles
 * For final state D: Include 0D, 1D, 2D, 3D
 */
function generateCompetingTiles(fsmData: FSMData): string[] {
  const tiles: string[] = [];
  const stateLabels = ['A', 'B', 'C', 'D'];
  
  // For each state (except the last), generate tiles for transitions
  for (let state = 1; state < fsmData.states; state++) {
    const stateTransitions = fsmData.transitions[state];
    if (stateTransitions) {
      for (const [symbol, nextState] of stateTransitions) {
        const nextStateLabel = stateLabels[parseInt(nextState, 10) - 1] || `S${nextState}`;
        tiles.push(`${symbol}${stateLabels[state - 1] || `S${state}`}${parseInt(nextState, 10)}`);
      }
    }
  }
  
  // For final state D, include 0D, 1D, 2D, 3D
  tiles.push('0D', '1D', '2D', '3D');
  
  return [...new Set(tiles)]; // Remove duplicates
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
  
  // Row 1: Headers
  const headerRow: string[] = ['Buffer'];
  for (let i = 0; i < experiments.length; i++) {
    headerRow.push(`Experiment ${i + 1}`);
    headerRow.push(`Control ${i + 1}`);
  }
  data.push(headerRow);
  
  // Row 2: Buffer value and experiment names
  const valuesRow: string[] = [bufferName];
  for (const exp of experiments) {
    valuesRow.push(exp.name);
    valuesRow.push(`${exp.name} Control`);
  }
  data.push(valuesRow);
  
  // Row 3: Empty (reserved spacing)
  data.push(Array(headerRow.length).fill(''));
  
  // Row 4: Experiment results
  const resultsRow: string[] = [''];
  for (const exp of experiments) {
    resultsRow.push(exp.result);
    resultsRow.push(''); // Control has no result
  }
  data.push(resultsRow);
  
  // Row 5-8: Empty spacing (5 rows below header block)
  for (let i = 0; i < 4; i++) {
    data.push(Array(headerRow.length).fill(''));
  }
  
  // Row 9: qPCR Positioning header
  const qpcrHeaderRow: string[] = ['qPCR Positioning'];
  data.push(qpcrHeaderRow);
  
  // qPCR positioning values
  data.push([`buffer 5rf (${bufferName})`]);
  
  for (let i = 0; i < experiments.length; i++) {
    data.push([`experiment ${i + 1}`]);
    data.push([`control ${i + 1}`]);
  }
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  const colWidths = headerRow.map(() => ({ wch: 20 }));
  ws['!cols'] = colWidths;
  
  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  
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
  
  // Calculate values
  const volumeToMove = calculateVolumeToMove(targetConcentration, totalVolume, stockConcentration);
  const droplets = calculateDroplets(volumeToMove);
  
  // Get competing tiles from FSM
  const competingTiles = generateCompetingTiles(fsmData);
  
  // Base reagents
  const baseReagents = ['A1'];
  const finalReagents = ['Scaffold', 'ATE', '5RF', '3RQ', '10xMG', 'Tween'];
  
  // Build header row
  const headerRow: string[] = ['Reagent', 'Target Conc.', 'Volume to Move', 'Droplets'];
  for (let i = 0; i < experiments.length; i++) {
    headerRow.push(`Exp ${i + 1}`);
    headerRow.push(`Ctrl ${i + 1}`);
  }
  data.push(headerRow);
  
  // All reagent rows (for experiments)
  const allReagentNames = [...baseReagents, ...competingTiles, ...finalReagents];
  
  for (const reagent of allReagentNames) {
    const row: (string | number)[] = [
      reagent,
      targetConcentration,
      Math.round(volumeToMove * 100) / 100,
      Math.round(droplets * 100) / 100
    ];
    
    // For each experiment and control
    for (let i = 0; i < experiments.length; i++) {
      // Experiment column - includes all reagents
      if (baseReagents.includes(reagent) || finalReagents.includes(reagent)) {
        row.push('✓');
      } else if (competingTiles.includes(reagent)) {
        row.push('✓'); // Experiments include competing tiles
      } else {
        row.push('');
      }
      
      // Control column - only includes base reagents and final reagents (no competing tiles)
      if (baseReagents.includes(reagent) || finalReagents.includes(reagent)) {
        row.push('✓');
      } else {
        row.push(''); // Controls don't include competing tiles
      }
    }
    
    data.push(row);
  }
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  const colWidths = headerRow.map((_, idx) => ({ wch: idx === 0 ? 20 : 15 }));
  ws['!cols'] = colWidths;
  
  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  
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
    data.push([`Experiment ${i + 1}`, experiments[i].name]);
    data.push([`  FSM Input`, experiments[i].fsmInput]);
    data.push([`  Result`, experiments[i].result]);
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
