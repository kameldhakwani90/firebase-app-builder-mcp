export interface Project {
  name: string;
  url: string;
  path: string;
  status: 'started' | 'cloning' | 'analyzing' | 'migrating' | 'testing' | 'completed' | 'error';
  currentStep: string;
  lastActivity: string;
  completedAt?: string;
  steps: ProjectStep[];
}

export interface ProjectStep {
  step: string;
  details: any;
  timestamp: string;
  duration: number;
  success?: boolean;
  error?: string;
}

export interface DataModel {
  name: string;
  fields: Record<string, string>;
  relationships?: Record<string, string>;
  mockFile?: string;
}

export interface AppFeature {
  type: 'auth' | 'crud' | 'api' | 'ui' | 'payment' | 'ai' | 'business';
  name: string;
  path: string;
  dependencies?: string[];
}

export interface TestScenario {
  name: string;
  type: 'user-journey' | 'crud' | 'auth' | 'api';
  steps: TestStep[];
}

export interface TestStep {
  action: string;
  selector?: string;
  value?: string;
  expected?: string;
  timeout?: number;
}

export interface MigrationConfig {
  database: {
    provider: 'postgresql' | 'mysql' | 'sqlite';
    url?: string;
  };
  framework: 'nextjs' | 'react' | 'vue';
  features: AppFeature[];
  testingEnabled: boolean;
}