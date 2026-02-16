import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Construction } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function PlaceholderPage() {
  const navigate = useNavigate();
  const { feature } = useParams();

  const featureNames: Record<string, string> = {
    'generate-states': 'Generate States',
    'generate-excel': 'Generate Experiment Sheet',
  };

  const featureName = feature ? featureNames[feature] || feature : 'Feature';

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md text-center animate-fade-in">
        <CardContent className="pt-10 pb-8">
          <Construction className="w-16 h-16 text-warning mx-auto mb-6" />
          <h1 className="text-2xl font-bold font-mono text-foreground mb-3">
            {featureName}
          </h1>
          <p className="text-muted-foreground text-lg">
            This functionality is not yet available.
          </p>
          <p className="text-muted-foreground text-sm mt-2">
            Check back soon for updates!
          </p>
        </CardContent>
      </Card>

      <Button
        variant="ghost"
        onClick={() => navigate('/actions')}
        className="mt-8 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Actions
      </Button>
    </div>
  );
}
