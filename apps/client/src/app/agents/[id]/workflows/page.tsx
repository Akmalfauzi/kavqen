import StudioApp from '@/components/StudioApp';

export default async function AgentWorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudioApp initialPage="workflows" agentId={id} />;
}
