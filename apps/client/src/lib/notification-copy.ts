// Translate legacy system templates without changing stored notifications or user text.
export function notificationCopy<T extends { title: string; description: string }>(item: T): T {
  const titles: Record<string, string> = {
    'Undangan Registrasi Workshop': 'Workshop registration invitation',
    'Undangan Survei Produk': 'Product survey invitation',
    'Submission demo tersedia': 'Demo submission available',
    'Undangan form baru': 'New form invitation',
    'Undangan diterima': 'Invitation accepted',
    'Undangan ditolak': 'Invitation declined',
    'Workflow diterbitkan': 'Workflow published',
    'Form baru dikirim': 'New form submission',
  };
  if (!titles[item.title]) return item;
  const descriptions: Record<string, string> = {
    'Buka dashboard untuk menerima atau menolak undangan.': 'Open your dashboard to accept or decline the invitation.',
  };
  let description = descriptions[item.description] || item.description;
  if (item.title === 'Workflow diterbitkan') description = description.replace(/ siap dibagikan\.$/, ' is ready to share.');
  if (item.title === 'Form baru dikirim') description = description.replace(/ menerima submission baru\.$/, ' received a new submission.');
  if (item.title === 'Undangan form baru') description = description.replace(/^(.*?) mengundang kamu mengisi (.*?)\. Buka dashboard untuk merespons\.$/, '$1 invited you to complete $2. Open your dashboard to respond.');
  if (item.title === 'Undangan diterima' || item.title === 'Undangan ditolak') description = description.replace(/^(.*?) merespons undangan (.*?)\.$/, '$1 responded to the invitation for $2.');
  return { ...item, title: titles[item.title], description };
}
