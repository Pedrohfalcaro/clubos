import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import { newSocialPost, type SocialPostType } from '../../types/Social';
import { getStoryArcDef } from '../../utils/storyArcs';
import SocialPost from './SocialPost';
import styles from './Social.module.css';

type Filter = 'all' | SocialPostType | 'arc';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tudo' },
  { id: 'headline', label: 'Manchetes' },
  { id: 'arc', label: 'Arcos' },
  { id: 'coach_post', label: 'Técnico' },
  { id: 'player_news', label: 'Elenco' },
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

export default function Social() {
  const { state, addSocialPost, markSocialSeen } = useGame();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [draft, setDraft] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.social.unseenCount > 0) markSocialSeen();
  }, [state.social.unseenCount, markSocialSeen]);

  const activeArc = state.social.activeArc;
  const arcDef = activeArc ? getStoryArcDef(activeArc.id) : undefined;
  const arcTotal = arcDef?.steps.length ?? 0;
  const arcDone = activeArc ? Math.min(activeArc.step, arcTotal) : 0;

  const posts = useMemo(() => {
    const list = [...state.social.posts].sort((a, b) => b.date.localeCompare(a.date));
    if (filter === 'all') return list;
    if (filter === 'arc') return list.filter(p => Boolean(p.arcId));
    return list.filter(p => p.type === filter);
  }, [state.social.posts, filter]);

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
    const author = state.manager?.name
      ? `${state.manager.name}`
      : state.social.handle;
    const teamTag = state.team?.name
      ? ` #${state.team.name.replace(/\s+/g, '')}`
      : '';
    const base = content || '📷';
    const withHashtag = /#\w/.test(base) ? base : `${base}${teamTag}`;
    addSocialPost(
      newSocialPost({
        date: (state.currentDate ?? new Date().toISOString()).slice(0, 10),
        type: 'coach_post',
        content: withHashtag.slice(0, MAX_LEN),
        author,
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
          <p className={styles.eyebrow}>LiveLife · LIFE</p>
          <h1 className={styles.brand}>ClubOSocial</h1>
          <p className={styles.handle}>{state.social.handle}</p>
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

      {activeArc && arcDef && (
        <div className={styles.arcBanner}>
          <div>
            <p className={styles.arcEyebrow}>Story Arc em andamento</p>
            <p className={styles.arcTitle}>{activeArc.title}</p>
            <p className={styles.arcMeta}>
              Capítulo {Math.max(1, arcDone)}/{arcTotal}
              {activeArc.playerName ? ` · ${activeArc.playerName}` : ''}
              {activeArc.pendingPress ? ' · coletiva sugerida' : ''}
            </p>
            <div className={styles.arcTrack} aria-hidden>
              {arcDef.steps.map((_, i) => (
                <span
                  key={i}
                  className={`${styles.arcDot} ${i < arcDone ? styles.arcDotOn : ''}`}
                />
              ))}
            </div>
          </div>
          {activeArc.pendingPress && (
            <button
              type="button"
              className={styles.arcCta}
              onClick={() => {
                const ctx = activeArc.pendingPressContext ?? 'story_arc';
                if (ctx === 'injury' && activeArc.playerId) {
                  navigate(
                    `/press-conference?ctx=injury&playerId=${activeArc.playerId}`,
                  );
                  return;
                }
                navigate('/press-conference?ctx=arc');
              }}
            >
              Falar com a imprensa
            </button>
          )}
        </div>
      )}

      <div className={styles.layout}>
        <section className={styles.feed} aria-label="Feed">
          {posts.length === 0 ? (
            <div className={styles.empty}>
              Nenhuma publicação ainda. Finalize uma partida para gerar manchetes
              ou publique como técnico. Arcos narrativos surgem ao Avançar Dia
              (vestiário, imprensa, lesão, diretoria).
            </div>
          ) : (
            posts.map(post => <SocialPost key={post.id} post={post} />)
          )}
        </section>

        <aside className={styles.composer}>
          <h2 className={styles.composerTitle}>Publicar</h2>
          <p className={styles.composerHint}>
            Post do técnico no perfil do clube. Texto e/ou imagem. Hashtag institucional
            é adicionada se você não incluir nenhuma.
          </p>
          <textarea
            className={styles.textarea}
            value={draft}
            maxLength={MAX_LEN}
            placeholder="Fala do vestiário, mensagem aos torcedores…"
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
