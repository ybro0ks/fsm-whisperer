import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, RotateCcw, CheckCircle, XCircle, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFSM } from '@/lib/fsm-context';
import { runFSM } from '@/lib/fsm-parser';
import FSMVisualizer from '@/components/FSMVisualizer';

interface TestResult {
  accepted: boolean;
  endState: number;
  error?: string;
  path: { state: number; symbol?: string }[];
}

export default function TestFSMPage() {
  const navigate = useNavigate();
  const { fsmData } = useFSM();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<TestResult | null>(null);
  const [currentState, setCurrentState] = useState<number | undefined>(undefined);
  const [highlightedTransition, setHighlightedTransition] = useState<{ from: number; symbol: string } | undefined>(undefined);
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!fsmData) {
      navigate('/');
    }
  }, [fsmData, navigate]);

  if (!fsmData) {
    return null;
  }

  const handleTest = () => {
    if (!input.trim()) return;

    const testResult = runFSM(fsmData, input);
    setResult(testResult);
    
    // Start animation
    setIsAnimating(true);
    setCurrentStep(0);
    animateStep(testResult.path, 0);
  };

  const animateStep = (path: { state: number; symbol?: string }[], step: number) => {
    if (step >= path.length) {
      setIsAnimating(false);
      setHighlightedTransition(undefined);
      return;
    }

    const currentPathItem = path[step];
    setCurrentState(currentPathItem.state);
    setCurrentStep(step);

    if (step > 0 && path[step - 1].symbol) {
      setHighlightedTransition({
        from: path[step - 1].state,
        symbol: path[step - 1].symbol!,
      });
    } else {
      setHighlightedTransition(undefined);
    }

    setTimeout(() => {
      animateStep(path, step + 1);
    }, 800);
  };

  const handleReset = () => {
    setInput('');
    setResult(null);
    setCurrentState(undefined);
    setHighlightedTransition(undefined);
    setIsAnimating(false);
    setCurrentStep(0);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/actions')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Actions
          </Button>
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold font-mono text-foreground">Test FSM: {fsmData.name}</h1>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid gap-6">
          {/* Visualizer */}
          <Card className="animate-fade-in">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-mono flex items-center gap-2">
                FSM Visualization
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <FSMVisualizer
                fsm={fsmData}
                currentState={currentState}
                highlightedTransition={highlightedTransition}
              />
            </CardContent>
          </Card>

          {/* Input Panel */}
          <Card className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-mono">Test Input</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter input sequence (e.g., 0101)"
                  className="font-mono text-lg"
                  disabled={isAnimating}
                />
                <Button
                  onClick={handleTest}
                  disabled={!input.trim() || isAnimating}
                  className="px-6"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Run
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={isAnimating}
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>

              {/* Valid symbols hint */}
              <p className="text-sm text-muted-foreground mt-3 font-mono">
                Valid symbols: {fsmData.symbols.join(', ')}
              </p>
            </CardContent>
          </Card>

          {/* Result Panel */}
          {result && (
            <Card 
              className={`animate-fade-in border-2 ${
                result.accepted 
                  ? 'border-success bg-success/5' 
                  : 'border-destructive bg-destructive/5'
              }`}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {result.accepted ? (
                      <CheckCircle className="w-10 h-10 text-success" />
                    ) : (
                      <XCircle className="w-10 h-10 text-destructive" />
                    )}
                    <div>
                      <h3 className={`text-2xl font-bold font-mono ${
                        result.accepted ? 'text-success' : 'text-destructive'
                      }`}>
                        {result.accepted ? 'ACCEPTED' : 'REJECTED'}
                      </h3>
                      <p className="text-muted-foreground">
                        {result.error || `Ended at state q${result.endState}`}
                      </p>
                    </div>
                  </div>

                  {/* Path display */}
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground mb-1">Execution Path</p>
                    <div className="flex items-center gap-1 font-mono text-sm flex-wrap justify-end">
                      {result.path.map((step, idx) => {
                        const isAcceptState = step.state === fsmData.acceptstate;
                        const isCurrentAnimating = idx === currentStep && isAnimating;
                        const isPast = idx < currentStep || !isAnimating;
                        
                        return (
                          <span key={idx} className="flex items-center">
                            <span 
                              className={`px-2 py-1 rounded flex items-center gap-1 ${
                                isCurrentAnimating
                                  ? 'bg-warning text-warning-foreground'
                                  : isPast
                                    ? isAcceptState 
                                      ? 'bg-success/20 text-success border border-success/30'
                                      : 'bg-destructive/20 text-destructive border border-destructive/30'
                                    : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              q{step.state}
                              {isPast && !isCurrentAnimating && (
                                isAcceptState 
                                  ? <CheckCircle className="w-3 h-3" />
                                  : <XCircle className="w-3 h-3" />
                              )}
                            </span>
                            {idx < result.path.length - 1 && (
                              <span className="text-muted-foreground mx-1">→</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
