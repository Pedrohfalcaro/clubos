import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../../context/GameContext';
import { newSocialPost, type SocialPostType } from '../../../types/Social';
import SocialPost from '../../Social/SocialPost';
import styles from '../../Social/Social.module.css';

type Filter = 'all' | SocialPostType;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tudo' },
  { id: 'headline', label: 'Manchetes' },
  { id: 'player_news', label: 'Meus posts' },
];

const MAX_LEN = 280;
const MAX_IMAGE_BYTES = 1_200_000;

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selecione um arquivo de imagem.'));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error('Imagem muito grande (máx. ~1,2 MB).'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

export default function PlayerSocial() {
  const { state, addSocialPost, markSocialSeen } = useGame();
  const player = state.careerPlayer;
  const [filter, setFilter] = useState<Filter>('all');
  const [draft, setDraft] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.social.unseenCount > 0) markSocialSeen();
  }, [state.social.unseenCount, markSocialSeen]);

  const posts = useMemo(() => {
    const list = [...state.social.posts].sort((a, b) => b.date.localeCompare(a.date));
    if (filter === 'all') return list;
    return list.filter(p => p.type === filter);
  }, [state.social.posts, filter]);

  if (!player) return null;

  async function onPickImage(file: File | null) {
    setImageError('');
    if (!file) return;
    try {
      const url = await readImageAsDataUrl(file);
      setImageDataUrl(url);
    } catch (err) {
      setImageDataUrl(null);
      setImageError(err instanceof Error ? err.message : 'Imagem inválida.');
    }
  }

  function publish() {
    const content = draft.trim();
    if (!content && !imageDataUrl) return;
    const base = content || '📷';
    addSocialPost(
      newSocialPost({
        date: (state.currentDate ?? new Date().toISOString()).slice(0, 10),
        type: 'player_news',
        content: base.slice(0, MAX_LEN),
        author: player!.name,
        imageDataUrl: imageDataUrl ?? undefined,
      }),
    );
    setDraft('');
    setImageDataUrl(null);
    setImageError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  const canPublish = Boolean(draft.trim() || imageDataUrl);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>ClubOS</p>
          <h1 className={styles.brand}>Redes Sociais</h1>
          <p className={styles.handle}>Manchetes e posts da sua carreira</p>
        </div>
        <div className={styles.filters} role="tablist" aria-label="Filtro do feed">
          {FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`${styles.filterBtn} ${filter === f.id ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.layout}>
        <section className={styles.feed} aria-label="Feed">
          {posts.length === 0 ? (
            <div className={styles.empty}>
              Nenhuma publicação ainda. Registre o desempenho de uma partida para
              gerar manchetes ou publique algo como {player.name}.
            </div>
          ) : (
            posts.map(post => <SocialPost key={post.id} post={post} />)
          )}
        </section>

        <aside className={styles.composer}>
          <h2 className={styles.composerTitle}>Publicar</h2>
          <p className={styles.composerHint}>
            Um post seu, texto e/ou imagem — visível pra torcida.
          </p>
          <textarea
            className={styles.textarea}
            value={draft}
            maxLength={MAX_LEN}
            placeholder="Uma mensagem para a torcida, um bastidor do dia a dia…"
            onChange={e => setDraft(e.target.value)}
          />

          {imageDataUrl && (
            <div className={styles.imagePreviewWrap}>
              <img className={styles.imagePreview} src={imageDataUrl} alt="Prévia" />
              <button
                type="button"
                className={styles.removeImage}
                onClick={() => {
                  setImageDataUrl(null);
                  if (fileRef.current) fileRef.current.value = '';
                }}
              >
                Remover imagem
              </button>
            </div>
          )}

          {imageError && <p className={styles.imageError}>{imageError}</p>}

          <div className={styles.composerActions}>
            <div className={styles.composerLeft}>
              <label className={styles.imageBtn}>
                Imagem
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={e => onPickImage(e.target.files?.[0] ?? null)}
                />
              </label>
              <span className={styles.charCount}>
                {draft.trim().length}/{MAX_LEN}
              </span>
            </div>
            <button
              type="button"
              className={styles.publishBtn}
              disabled={!canPublish}
              onClick={publish}
            >
              Publicar
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
