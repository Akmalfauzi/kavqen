import { redirect } from 'next/navigation';

// Workflows live under their agent now: /agents/:agentId/workflows
export default function LegacyWorkflowsPage() {
  redirect('/agents');
}
