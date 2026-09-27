import { redirect } from 'next/navigation';

// Live test lives under its agent now: /agents/:agentId/live-test
export default function LegacyTestAgentPage() {
  redirect('/agents');
}
