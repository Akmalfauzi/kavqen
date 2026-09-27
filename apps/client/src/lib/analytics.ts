export interface AnalyticsSummary {
  totalWorkflows: number;
  publishedWorkflows: number;
  totalSubmissions: number;
  submissionsLast7Days: number;
  lastSevenDays: Array<{ date: string; count: number }>;
  byWorkflow: Array<{ id: string; name: string; status: string; submissions: number }>;
  recentSubmissions: Array<{ id: string; workflowId: string; createdAt: string }>;
}
