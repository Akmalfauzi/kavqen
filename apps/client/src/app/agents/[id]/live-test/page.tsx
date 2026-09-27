import StudioApp from '@/components/StudioApp';

export default async function AgentLiveTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudioApp initialPage="test-agent" agentId={id} />;
}
