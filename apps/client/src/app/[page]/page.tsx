import StudioApp from '@/components/StudioApp';

export async function generateStaticParams() {
  return [
    { page: 'dashboard' },
    { page: 'agents' },
    { page: 'submissions' },
    { page: 'fields' },
    { page: 'users' },
    { page: 'roles' },
    { page: 'permissions' },
    { page: 'permission-groups' },
    { page: 'knowledge' },
    { page: 'analytics' },
    { page: 'test' },
    { page: 'integrations' },
    { page: 'profile' },
    { page: 'notifications' },
  ];
}

export default async function DynamicRoutePage({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  return <StudioApp initialPage={page} />;
}
