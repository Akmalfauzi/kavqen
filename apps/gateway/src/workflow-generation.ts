interface StepInput {
  title: string;
  purpose: string;
  target_fields?: string[];
}

export function buildGeneratedWorkflow(content: string, availableFieldNames: string[]) {
  let parsed: unknown;
  try {
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    parsed = JSON.parse(cleaned);
  } catch {
    return { error: 'AI returned invalid workflow data' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: 'AI returned invalid workflow data' };
  }
  const steps = (parsed as Record<string, unknown>).steps;
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 8) {
    return { error: 'AI must return 1 to 8 workflow steps' };
  }
  const allowed = new Set(availableFieldNames);
  const valid = steps.every((step): step is StepInput => {
    if (!step || typeof step !== 'object' || Array.isArray(step)) return false;
    const item = step as Record<string, unknown>;
    return typeof item.title === 'string' && !!item.title.trim() && item.title.length <= 100 &&
      typeof item.purpose === 'string' && !!item.purpose.trim() && item.purpose.length <= 500 &&
      (item.target_fields === undefined ||
        (Array.isArray(item.target_fields) && item.target_fields.length <= 20 &&
          item.target_fields.every((name) => typeof name === 'string' && allowed.has(name))));
  });
  if (!valid) return { error: 'AI returned invalid steps or unknown master fields' };

  const nodes = [
    {
      id: 'generated_trigger', type: 'trigger', title: 'Start', icon: 'flag', color: 'blue',
      config: { step_name: 'Start', purpose: 'Greet the caller and begin the workflow.', target_fields: [] as string[] },
      position: { x: 320, y: 30 }
    },
    ...steps.map((step: StepInput, index: number) => ({
      id: `generated_step_${index + 1}`, type: 'step', title: step.title.trim(), icon: 'pink', color: 'pink',
      config: { step_name: step.title.trim(), purpose: step.purpose.trim(), target_fields: [...new Set(step.target_fields || [])] },
      position: { x: 320, y: 150 + index * 150 }
    })),
    {
      id: 'generated_end', type: 'action', title: 'End Call', icon: 'phone-x', color: 'rose',
      config: { step_name: 'End Call', purpose: 'Thank the caller and end the conversation.', target_fields: [] as string[] },
      position: { x: 320, y: 150 + steps.length * 150 }
    }
  ];
  const edges = nodes.slice(0, -1).map((node, index) => ({
    id: `generated_edge_${index + 1}`, from: node.id, to: nodes[index + 1].id
  }));
  return { nodes, edges };
}
