import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Play, Table, FileSpreadsheet, ArrowLeft, CheckCircle, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFSM } from '@/lib/fsm-context';

export default function ActionsPage() {
  const navigate = useNavigate();
  const { fsmData, fileName, clearFSMData } = useFSM();

  useEffect(() => {
    if (!fsmData) {
      navigate('/');
    }
  }, [fsmData, navigate]);

  if (!fsmData) {
    return null;
  }

  const handleBack = () => {
    clearFSMData();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-8 animate-fade-in">
        <div className="flex items-center justify-center gap-2 mb-2">
          <CheckCircle className="w-6 h-6 text-success" />
          <span className="text-success font-medium">Validation Successful</span>
        </div>
        <h1 className="text-3xl font-bold font-mono text-foreground mb-2">{fsmData.name}</h1>
        <p className="text-muted-foreground font-mono text-sm">{fileName}</p>
      </div>

      {/* FSM Info Card */}
      <Card className="w-full max-w-lg mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-mono flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            FSM Properties
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
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

      {/* Action Buttons */}
      <div className="w-full max-w-lg space-y-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <h2 className="text-lg font-semibold text-foreground text-center mb-4">Choose an Action</h2>
        
        <Button
          onClick={() => navigate('/test-fsm')}
          className="w-full h-14 text-base font-medium justify-start px-6"
        >
          <Play className="w-5 h-5 mr-4" />
          Test FSM
          <span className="ml-auto text-primary-foreground/70 text-sm">Run input sequences</span>
        </Button>

        <Button
          onClick={() => navigate('/generate-states')}
          className="w-full h-14 text-base font-medium justify-start px-6"
        >
          <Table className="w-5 h-5 mr-4" />
          Generate States
          <span className="ml-auto text-primary-foreground/70 text-sm">Step visualization</span>
        </Button>

        <Button
          onClick={() => navigate('/placeholder/generate-excel')}
          variant="secondary"
          className="w-full h-14 text-base font-medium justify-start px-6"
        >
          <FileSpreadsheet className="w-5 h-5 mr-4" />
          Generate Excel Sheet
          <span className="ml-auto text-secondary-foreground/50 text-sm">Coming soon</span>
        </Button>
      </div>

      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={handleBack}
        className="mt-8 text-muted-foreground hover:text-foreground animate-fade-in"
        style={{ animationDelay: '0.3s' }}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Upload New File
      </Button>
    </div>
  );
}
