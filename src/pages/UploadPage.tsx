import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, AlertCircle, Loader2, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useFSM } from '@/lib/fsm-context';
import { parseFSMFile, FSMValidationError } from '@/lib/fsm-parser';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { setFSMData } = useFSM();

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleValidate = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const content = await file.text();
      const fsmData = parseFSMFile(content);
      setFSMData(fsmData, file.name);
      navigate('/actions');
    } catch (err) {
      if (err instanceof FSMValidationError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-10 animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Terminal className="w-10 h-10 text-primary" />
          <h1 className="text-4xl font-bold font-mono text-foreground">FSM Validator</h1>
        </div>
        <p className="text-muted-foreground text-lg max-w-md">
          Upload your Finite State Machine definition file to validate and visualize
        </p>
      </div>

      {/* Upload Card */}
      <Card className="w-full max-w-lg shadow-lg animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <CardContent className="p-8">
          {/* Drop Zone */}
          <div
            className={`
              relative border-2 border-dashed rounded-lg p-10 text-center transition-all duration-200 cursor-pointer
              ${isDragOver 
                ? 'border-primary bg-primary/5' 
                : file 
                  ? 'border-success bg-success/5' 
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.fsm"
              onChange={handleFileInputChange}
              className="hidden"
            />
            
            {file ? (
              <div className="flex flex-col items-center gap-3">
                <FileText className="w-12 h-12 text-success" />
                <div>
                  <p className="font-mono font-medium text-foreground">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload className="w-12 h-12 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">Drop your FSM file here</p>
                  <p className="text-sm text-muted-foreground">or click to browse</p>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive text-sm">Validation Error</p>
                <p className="text-sm text-destructive/80 font-mono mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Validate Button */}
          <Button
            onClick={handleValidate}
            disabled={!file || isLoading}
            className="w-full mt-6 h-12 text-base font-medium"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <Terminal className="w-5 h-5 mr-2" />
                Validate File
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Footer hint */}
      <p className="mt-8 text-sm text-muted-foreground font-mono animate-fade-in" style={{ animationDelay: '0.2s' }}>
        Supports .txt and .fsm file formats
      </p>
    </div>
  );
}
