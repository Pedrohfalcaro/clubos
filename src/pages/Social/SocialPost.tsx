import { useState } from 'react';
import type { SocialPost as SocialPostType } from '../../types/Social';
import { HEADLINE_STYLE_META } from '../../utils/socialHeadlines';
import styles from './Social.module.css';

const TYPE_LABEL: Record<SocialPostType['type'], string> = {
  headline: 'Manchete',
  coach_post: 'Técnico',
  player_news: 'Elenco',
};

const TYPE_CLASS: Record<SocialPostType['type'], string> = {
  headline: styles.postHeadline,
  coach_post: styles.postCoach,
  player_news: styles.postPlayer,
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

interface Props {
  post: SocialPostType;
}

export default function SocialPost({ post }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isHeadline = post.type === 'headline';
  const body = post.body?.trim();
  const canExpand = isHeadline && !!body;

  return (
    <article className={`${styles.post} ${TYPE_CLASS[post.type]}`}>
      <div className={styles.postMeta}>
        <div>
          <span className={styles.postAuthor}>{post.author}</span>
          {' · '}
          <span className={styles.postType}>{TYPE_LABEL[post.type]}</span>
          {post.headlineStyle && (
            <>
              {' · '}
              <span className={styles.postStyle}>
                {HEADLINE_STYLE_META[post.headlineStyle].label}
              </span>
            </>
          )}
          {post.arcTitle && (
            <>
              {' · '}
              <span className={styles.postArc}>
                {post.arcTitle}
                {post.arcStep != null ? ` · ${post.arcStep}` : ''}
              </span>
            </>
          )}
        </div>
        <time className={styles.postDate} dateTime={post.date}>
          {formatDate(post.date)}
        </time>
      </div>

      {canExpand ? (
        <button
          type="button"
          className={styles.headlineBtn}
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
        >
          <span className={styles.headlineTitle}>{post.content}</span>
          <span className={styles.expandHint}>{expanded ? 'Recolher' : 'Ler mais'}</span>
        </button>
      ) : (
        <p className={styles.postContent}>{post.content}</p>
      )}

      {canExpand && expanded && (
        <p className={styles.postBody}>{body}</p>
      )}

      {post.imageDataUrl && (
        <img
          className={styles.postImage}
          src={post.imageDataUrl}
          alt=""
        />
      )}

      <div className={styles.postFooter}>
        <span className={styles.likes}>{post.likes} curtidas</span>
      </div>
    </article>
  );
}
