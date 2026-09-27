export function referencedFieldNames(nodes: unknown[]): { names?: string[]; error?: string } {
  const names = new Set<string>();
  for (const node of nodes) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      return { error: 'Workflow contains an invalid node' };
    }
    const config = (node as Record<string, unknown>).config;
    if (config === undefined || config === null) continue;
    if (typeof config !== 'object' || Array.isArray(config)) {
      return { error: 'Workflow contains invalid node configuration' };
    }
    const targetFields = (config as Record<string, unknown>).target_fields;
    if (targetFields === undefined || targetFields === null) continue;
    if (!Array.isArray(targetFields) || targetFields.some((name) => typeof name !== 'string' || !name.trim())) {
      return { error: 'Workflow contains invalid target fields' };
    }
    targetFields.forEach((name: string) => names.add(name));
  }
  if (!names.size) return { error: 'Link at least one master field before publishing' };
  return { names: [...names] };
}
