// lib/types/filters.ts
export interface FeedFilters {
  search?: string;
  users?: string[];          // user IDs (team leads only)
  project?: string;          // project ID
  dateRange?: {
    from: Date;
    to: Date;
  };
  scoreRange?: {
    min: number;
    max: number;
  };
}

export interface SerializedFeedFilters {
  search?: string;
  users?: string[];
  project?: string;
  dateRange?: {
    from: string;  // ISO string for localStorage
    to: string;
  };
  scoreRange?: {
    min: number;
    max: number;
  };
}
