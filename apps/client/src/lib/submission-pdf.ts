import type { TDocumentDefinitions } from 'pdfmake/interfaces';

interface SubmissionReceipt {
  id: string;
  fields?: { name: string; label?: string }[];
  workflow: { name: string };
  createdAt: string;
  data: Record<string, unknown>;
  user?: { name: string | null; email: string } | null;
  agentName?: string | null;
}

export const submissionFieldLabel = (name: string) => name
  .replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/\b\w/g, character => character.toUpperCase());

export const submissionAnswer = (value: unknown): string => {
  if (value == null || value === '') return 'Not provided';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
};

export function orderedSubmissionAnswers(item: Pick<SubmissionReceipt, 'data' | 'fields'>) {
  const seen = new Set<string>();
  const answers: { name: string; label: string; value: unknown }[] = [];
  for (const field of item.fields || []) {
    if (seen.has(field.name) || !Object.prototype.hasOwnProperty.call(item.data, field.name)) continue;
    seen.add(field.name);
    answers.push({ name: field.name, label: field.label || submissionFieldLabel(field.name), value: item.data[field.name] });
  }
  // Preserve legacy answers whose fields were removed from the published form.
  for (const [name, value] of Object.entries(item.data)) {
    if (!seen.has(name)) answers.push({ name, label: submissionFieldLabel(name), value });
  }
  return answers;
}

export function submissionPdfDefinition(item: SubmissionReceipt, personal: boolean): TDocumentDefinitions {
  const submittedAt = new Date(item.createdAt).toLocaleString('en-US', { timeZoneName: 'short' });
  return {
    pageSize: 'A4',
    pageMargins: [44, 44, 44, 52],
    info: { title: `${item.workflow.name} - Submission receipt`, author: 'Kavqen' },
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#0f172a', lineHeight: 1.3 },
    content: [
      { text: 'KAVQEN / SUBMISSION RECEIPT', color: '#4f46e5', bold: true, fontSize: 10, margin: [0, 0, 0, 16] },
      { text: item.workflow.name, bold: true, fontSize: 23, margin: [0, 0, 0, 12] },
      { text: 'Submitted', color: '#047857', bold: true, margin: [0, 0, 0, 8] },
      { text: `Submitted at: ${submittedAt}`, color: '#475569' },
      { text: `Receipt ID: ${item.id}`, color: '#475569', margin: [0, 4, 0, 0] },
      ...(!personal ? [{ text: `Submitted by: ${item.user?.name || item.user?.email || item.agentName || 'Owner'}`, color: '#475569', margin: [0, 4, 0, 0] as [number, number, number, number] }] : []),
      { text: 'Submitted answers', bold: true, fontSize: 14, margin: [0, 24, 0, 12] },
      ...orderedSubmissionAnswers(item).map(({ label, value }) => ({
        stack: [
          { text: label, bold: true, color: '#475569', margin: [0, 0, 0, 5] as [number, number, number, number] },
          { text: submissionAnswer(value) },
        ],
        margin: [0, 0, 0, 16] as [number, number, number, number],
      })),
    ],
    // Keep each field label with its answer's first line, including long multi-page answers.
    pageBreakBefore: node => Boolean(node.stack && node.pageNumbers.length > 1 && node.startPosition?.verticalRatio > 0.9),
    footer: (page, pages) => ({
      columns: [{ text: 'Kavqen - Submission receipt' }, { text: `Page ${page} of ${pages}`, alignment: 'right' }],
      fontSize: 8, color: '#64748b', margin: [44, 18, 44, 0],
    }),
  };
}

export async function downloadSubmissionPdf(item: SubmissionReceipt, personal: boolean) {
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  const document = pdfMake.createPdf(submissionPdfDefinition(item, personal), undefined, undefined, fonts);
  const blob = await new Promise<Blob>(resolve => document.getBlob(resolve));
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  const name = item.workflow.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 80) || 'form';
  link.download = `${name}-${item.id}.pdf`;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
