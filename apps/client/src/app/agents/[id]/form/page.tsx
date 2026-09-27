import StudioApp from '@/components/StudioApp';

export default async function AgentFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudioApp initialPage="agents" agentId={id} />;
}
