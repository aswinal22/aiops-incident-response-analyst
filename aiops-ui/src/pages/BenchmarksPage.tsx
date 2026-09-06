import React from 'react';
import { InteractiveBenchmarkInspector } from '../components/evals/InteractiveBenchmarkInspector';

export const BenchmarksPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <InteractiveBenchmarkInspector />
    </div>
  );
};
