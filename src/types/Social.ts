import type { ActiveStoryArc, StoryArcHistoryEntry } from './StoryArc';

export type SocialPostType = 'headline' | 'coach_post' | 'player_news';

/** Estilo editorial da manchete automática. */
export type HeadlineStyle =
  | 'journalistic'
  | 'analytical'
  | 'sensational'
  | 'chronicle'
  | 'flash';

export interface SocialPost {
  id: string;
  date: string; // gameDate ISO
  type: SocialPostType;
  /** Título (manchete) ou texto principal (posts). */
  content: string;
  /** Corpo expandido da manchete. */
  body?: string;
  headlineStyle?: HeadlineStyle;
  /** Imagem embutida (data URL) — posts do técnico. */
  imageDataUrl?: string;
  author: string;
  likes: number;
  matchId?: string;
  /** Story Arc — amarra o post a um arco narrativo. */
  arcId?: string;
  arcStep?: number;
  arcTitle?: string;
}

export interface SocialState {
  handle: string;
  posts: SocialPost[];
  unseenCount: number;
  activeArc?: ActiveStoryArc | null;
  arcHistory?: StoryArcHistoryEntry[];
}

function slugHandle(teamName: string): string {
  const slug = teamName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 18);
  return `@${slug || 'clube'}_oficial`;
}

export function createDefaultSocialState(teamName = 'Clube'): SocialState {
  return {
    handle: slugHandle(teamName),
    posts: [],
    unseenCount: 0,
    activeArc: null,
    arcHistory: [],
  };
}

export function newSocialPost(
  input: Omit<SocialPost, 'id' | 'likes'> & { likes?: number },
): SocialPost {
  return {
    id: `social-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    likes: input.likes ?? Math.floor(40 + Math.random() * 220),
    date: input.date,
    type: input.type,
    content: input.content,
    body: input.body,
    headlineStyle: input.headlineStyle,
    imageDataUrl: input.imageDataUrl,
    author: input.author,
    matchId: input.matchId,
    arcId: input.arcId,
    arcStep: input.arcStep,
    arcTitle: input.arcTitle,
  };
}
