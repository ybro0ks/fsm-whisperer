import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, RotateCcw, Table } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFSM } from '@/lib/fsm-context';
import { generateFSMSteps, GenerationResult } from '@/lib/fsm-step-generator';

export default function GenerateStatesPage() {
  const navigate = useNavigate();
  const { fsmData } = useFSM();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<GenerationResult | null>(null);

  useEffect(() => {
    if (!fsmData) {
      navigate('/');
    }
  }, [fsmData, navigate]);

  if (!fsmData) {
    return null;
  }

  const handleGenerate = () => {
    if (!input.trim()) return;
    
    const generationResult = generateFSMSteps(fsmData, input);
    setResult(generationResult);
  };

  const handleReset = () => {
    setInput('');
    setResult(null);
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
            <Table className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold font-mono text-foreground">
              Generate States: {fsmData.name}
            </h1>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid gap-6">
          {/* Input Panel */}
          <Card className="animate-fade-in">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-mono">Input String</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter input sequence (e.g., 0101)"
                  className="font-mono text-lg"
                />
                <Button
                  onClick={handleGenerate}
                  disabled={!input.trim()}
                  className="px-6"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Generate
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>

              {/* Valid symbols hint */}
              <p className="text-sm text-muted-foreground mt-3 font-mono">
                Valid symbols: {fsmData.symbols.join(', ')} (chunk size: {fsmData.symbols[0]?.length || 1})
              </p>
            </CardContent>
          </Card>

          {/* Result Panel */}
          {result && (
            <Card className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-mono flex items-center gap-2">
                  Generated Steps
                  <span className="text-sm font-normal text-muted-foreground">
                    ({result.steps.length} positions)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4 overflow-auto max-h-[500px]">
                  <pre className="font-mono text-sm text-foreground whitespace-pre-wrap">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* FSM Info Card */}
          <Card className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-mono">FSM Properties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground">States</p>
                  <p className="font-mono font-medium text-foreground">{fsmData.states}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Symbols</p>
                  <p className="font-mono font-medium text-foreground">{fsmData.symbols.join(', ')}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Start State</p>
                  <p className="font-mono font-medium text-foreground">q{fsmData.startstate}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Accept State</p>
                  <p className="font-mono font-medium text-foreground">q{fsmData.acceptstate}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
