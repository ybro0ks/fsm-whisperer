import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, FileSpreadsheet, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useFSM } from '@/lib/fsm-context';
import { evaluateFSM, generateExcelWorkbook, downloadExcel, generateFilename, ExperimentInput } from '@/lib/excel-generator';

type Step = 'count' | 'experiments' | 'concentrations' | 'generate';

interface ExperimentData {
  name: string;
  fsmInput: string;
  fluorophore: string;
  result: 'ACCEPT' | 'REJECT' | null;
  finalState: number | null;
}

export default function GenerateExcelPage() {
  const navigate = useNavigate();
  const { fsmData } = useFSM();

  // Step state
  const [currentStep, setCurrentStep] = useState<Step>('count');
  
  // Form data
  const [experimentCount, setExperimentCount] = useState<number>(1);
  const bufferName = '5RF (ATTO) 79nM';
  const [experiments, setExperiments] = useState<ExperimentData[]>([]);
  const [stockConcentration, setStockConcentration] = useState<number>(50);
  const [targetConcentration, setTargetConcentration] = useState<number>(1);
  const [totalVolume, setTotalVolume] = useState<number>(80);
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!fsmData) {
      navigate('/');
    }
  }, [fsmData, navigate]);

  if (!fsmData) {
    return null;
  }

  const initializeExperiments = () => {
    const newExperiments: ExperimentData[] = [];
    for (let i = 0; i < experimentCount; i++) {
      newExperiments.push({
        name: '',
        fsmInput: '',
        fluorophore: 'ANS N',
        result: null,
        finalState: null,
      });
    }
    setExperiments(newExperiments);
  };

  const updateExperiment = (index: number, field: keyof ExperimentData, value: string) => {
    const updated = [...experiments];
    updated[index] = { ...updated[index], [field]: value };
    
    // If updating fsmInput, validate it and get final state
    if (field === 'fsmInput' && value.trim()) {
      try {
        const evalResult = evaluateFSM(fsmData, value.trim());
        updated[index].result = evalResult.result;
        updated[index].finalState = evalResult.finalState;
      } catch {
        updated[index].result = null;
        updated[index].finalState = null;
      }
    }
    
    setExperiments(updated);
  };

  const validateExperiments = (): boolean => {
    for (let i = 0; i < experiments.length; i++) {
      const exp = experiments[i];
      if (!exp.name.trim()) {
        setError(`Experiment ${i + 1} is missing a name`);
        return false;
      }
      if (!exp.fsmInput.trim()) {
        setError(`Experiment ${i + 1} is missing an FSM input value`);
        return false;
      }
      if (!exp.fluorophore.trim()) {
        setError(`Experiment ${i + 1} is missing a fluorophore`);
        return false;
      }
      if (exp.result === null) {
        setError(`Experiment ${i + 1} has an invalid FSM input`);
        return false;
      }
    }
    
    return true;
  };

  const handleNext = () => {
    setError(null);
    
    switch (currentStep) {
      case 'count':
        if (experimentCount < 1) {
          setError('You must have at least 1 experiment');
          return;
        }
        initializeExperiments();
        setCurrentStep('experiments');
        break;
      case 'experiments':
        if (!validateExperiments()) return;
        setCurrentStep('concentrations');
        break;
      case 'experiments':
        if (!validateExperiments()) return;
        setCurrentStep('concentrations');
        break;
      case 'concentrations':
        if (targetConcentration <= 0) {
          setError('Target concentration must be greater than 0');
          return;
        }
        if (totalVolume <= 0) {
          setError('Total volume must be greater than 0');
          return;
        }
        setCurrentStep('generate');
        break;
    }
  };

  const handleBack = () => {
    setError(null);
    switch (currentStep) {
      case 'experiments':
        setCurrentStep('count');
        break;
      case 'concentrations':
        setCurrentStep('experiments');
        break;
      case 'generate':
        setCurrentStep('concentrations');
        break;
    }
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const experimentInputs: ExperimentInput[] = experiments.map(exp => ({
        name: exp.name,
        fsmInput: exp.fsmInput,
        result: exp.result!,
        finalState: exp.finalState!,
        fluorophore: exp.fluorophore,
      }));
      
      const workbook = generateExcelWorkbook({
        experiments: experimentInputs,
        stockConcentration: stockConcentration || 50,
        targetConcentration,
        totalVolume,
      }, fsmData);
      
      const filename = generateFilename();
      downloadExcel(workbook, filename);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate Excel file');
    } finally {
      setIsGenerating(false);
    }
  };

  const stepTitles: Record<Step, string> = {
    count: 'Step 1: Number of Experiments',
    experiments: 'Step 2: Experiment Details',
    concentrations: 'Step 3: Concentration & Volume',
    generate: 'Step 4: Generate Excel File',
  };

  const stepDescriptions: Record<Step, string> = {
    count: 'How many experiments are being performed?',
    experiments: 'Enter details for each experiment including fluorophore',
    concentrations: 'Enter concentration and volume parameters',
    generate: 'Review and generate your Excel file',
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-6">
      {/* Header */}
      <div className="w-full max-w-2xl mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/actions')}
          className="text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Actions
        </Button>
        
        <div className="flex items-center gap-3 mb-2">
          <FileSpreadsheet className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold font-mono text-foreground">Generate Excel Sheet</h1>
        </div>
        <p className="text-muted-foreground">FSM: {fsmData.name}</p>
      </div>

      {/* Progress Indicator */}
      <div className="w-full max-w-2xl mb-6">
        <div className="flex justify-between items-center">
          {(['count', 'experiments', 'concentrations', 'generate'] as Step[]).map((step, idx) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep === step 
                  ? 'bg-primary text-primary-foreground' 
                  : idx < ['count', 'experiments', 'concentrations', 'generate'].indexOf(currentStep)
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
              }`}>
                {idx + 1}
              </div>
              {idx < 3 && (
                <div className={`w-12 md:w-24 h-0.5 mx-1 ${
                  idx < ['count', 'experiments', 'concentrations', 'generate'].indexOf(currentStep)
                    ? 'bg-primary/40'
                    : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Card */}
      <Card className="w-full max-w-2xl animate-fade-in">
        <CardHeader>
          <CardTitle className="font-mono">{stepTitles[currentStep]}</CardTitle>
          <CardDescription>{stepDescriptions[currentStep]}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Step Content */}
          {currentStep === 'count' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="experimentCount">Number of Experiments</Label>
                <Input
                  id="experimentCount"
                  type="number"
                  min={1}
                  max={20}
                  value={experimentCount}
                  onChange={(e) => setExperimentCount(parseInt(e.target.value) || 1)}
                  className="font-mono"
                />
              </div>
            </div>
          )}


          {currentStep === 'experiments' && (
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {experiments.map((exp, idx) => (
                <Card key={idx} className="p-4 bg-muted/30">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono font-medium">Experiment {idx + 1}</span>
                    <div className="flex items-center gap-2">
                      {exp.finalState !== null && (
                        <span className="px-2 py-1 rounded text-xs font-mono bg-muted">
                          State: q{exp.finalState}
                        </span>
                      )}
                      {exp.result && (
                        <span className={`px-2 py-1 rounded text-xs font-mono ${
                          exp.result === 'ACCEPT' 
                            ? 'bg-success/20 text-success' 
                            : 'bg-destructive/20 text-destructive'
                        }`}>
                          {exp.result}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-3">
                    <div className="space-y-1">
                      <Label htmlFor={`exp-name-${idx}`} className="text-xs">
                        Experiment Name (e.g., DIV 1110)
                      </Label>
                      <Input
                        id={`exp-name-${idx}`}
                        placeholder="DIV 1110"
                        value={exp.name}
                        onChange={(e) => updateExperiment(idx, 'name', e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`exp-input-${idx}`} className="text-xs">
                        FSM Input Value (e.g., 1110 or 0000)
                      </Label>
                      <Input
                        id={`exp-input-${idx}`}
                        placeholder="1110"
                        value={exp.fsmInput}
                        onChange={(e) => updateExperiment(idx, 'fsmInput', e.target.value)}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`exp-fluor-${idx}`} className="text-xs">
                        Fluorophore (e.g., ANS N)
                      </Label>
                      <Input
                        id={`exp-fluor-${idx}`}
                        placeholder="ANS N"
                        value={exp.fluorophore}
                        onChange={(e) => updateExperiment(idx, 'fluorophore', e.target.value)}
                        className="font-mono"
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {currentStep === 'concentrations' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="stockConc">Stock Concentration (µM)</Label>
                <Input
                  id="stockConc"
                  type="number"
                  placeholder="50"
                  value={stockConcentration || ''}
                  onChange={(e) => setStockConcentration(parseFloat(e.target.value) || 50)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">Default: 50 µM</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetConc">Target Concentration (µM) *</Label>
                <Input
                  id="targetConc"
                  type="number"
                  step="0.1"
                  value={targetConcentration || ''}
                  onChange={(e) => setTargetConcentration(parseFloat(e.target.value) || 0)}
                  className="font-mono"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalVol">Total Reaction Volume (nL) *</Label>
                <Input
                  id="totalVol"
                  type="number"
                  step="1"
                  value={totalVolume || ''}
                  onChange={(e) => setTotalVolume(parseFloat(e.target.value) || 0)}
                  className="font-mono"
                  required
                />
                <p className="text-xs text-muted-foreground">Default: 80 nL</p>
              </div>
            </div>
          )}

          {currentStep === 'generate' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Summary</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Experiments:</span>
                    <span className="ml-2 font-mono">{experiments.length}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Buffer:</span>
                    <span className="ml-2 font-mono text-xs">5RF (ATTO) 79nM</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Stock Conc.:</span>
                    <span className="ml-2 font-mono">{stockConcentration || 50} µM</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Target Conc.:</span>
                    <span className="ml-2 font-mono">{targetConcentration} µM</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Volume:</span>
                    <span className="ml-2 font-mono">{totalVolume} nL</span>
                  </div>
                </div>
                
                <div className="border-t border-border pt-3 mt-3">
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Experiments:</h4>
                  <div className="space-y-2">
                    {experiments.map((exp, idx) => (
                      <div key={idx} className="bg-background rounded p-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-medium">{exp.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            exp.result === 'ACCEPT' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                          }`}>
                            {exp.result}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Input: <code className="bg-muted px-1 rounded">{exp.fsmInput}</code>
                          {' → '}Position {exp.finalState}; {exp.fluorophore}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full h-12"
              >
                <Download className="w-5 h-5 mr-2" />
                {isGenerating ? 'Generating...' : 'Download Excel File'}
              </Button>
            </div>
          )}

          {/* Navigation Buttons */}
          {currentStep !== 'generate' && (
            <div className="flex justify-between pt-4">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={currentStep === 'count'}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleNext}>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {currentStep === 'generate' && (
            <Button
              variant="ghost"
              onClick={handleBack}
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Edit
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
