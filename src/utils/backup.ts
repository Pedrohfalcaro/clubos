import JSZip from 'jszip';
import type { GameSave } from '../services/storage';

/**
 * Build a ZIP backup of the current career save and trigger download.
 */
export async function downloadSaveBackup(save: GameSave, clubName?: string): Promise<void> {
  const zip = new JSZip();
  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = (clubName ?? 'clubos')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'clubos';

  zip.file('save.json', JSON.stringify(save, null, 2));
  zip.file(
    'README.txt',
    [
      'ClubOS — Backup de carreira',
      `Clube: ${clubName ?? '—'}`,
      `Data: ${save.savedAt}`,
      `Versão: ${save.version}`,
      '',
      'Este ZIP contém o save completo em save.json.',
      'Guarde em local seguro. Em breve poderá ser usado para restaurar a carreira.',
    ].join('\n'),
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clubos-backup-${safeName}-${stamp}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
