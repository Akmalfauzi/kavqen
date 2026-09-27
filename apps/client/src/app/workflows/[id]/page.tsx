import { redirect } from 'next/navigation';

// Workflows are edited from their agent now: /agents/:agentId/workflows
export default function LegacyWorkflowPage() {
  redirect('/agents');
}
