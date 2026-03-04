export interface ReviewCriteria {
  reviewTitle: string;
  reviewType: 'systematic' | 'scoping' | 'narrative' | 'other';
  inclusionCriteria: string[];
  exclusionCriteria: string[];
}

export interface Article {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  year: string;
  journal: string;
  doi: string;
  keywords: string[];
  rawRis: string;
  decision: 'include' | 'exclude' | 'maybe' | 'pending';
  aiReasoning: string;
  aiConfidence: number;
  primaryExclusionReason: string;
  userOverride: boolean;
  originalAiDecision: 'include' | 'exclude' | 'maybe' | null;
  isDuplicate: boolean;
}

export interface ReviewSession {
  id: string;
  criteria: ReviewCriteria;
  articles: Article[];
  status: 'setup' | 'reviewing' | 'complete' | 'error';
  reviewedCount: number;
  totalCount: number;
  duplicatesRemoved: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

export type AppPage = 'setup' | 'review' | 'results';

export interface PrismaStats {
  identified: number;
  duplicatesRemoved: number;
  screened: number;
  included: number;
  excluded: number;
  maybe: number;
  exclusionReasons: Record<string, number>;
}
