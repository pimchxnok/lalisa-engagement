import type { Post } from './types'

/** Owner-set goal; Media posts without one fall back to their own live comment count */
export function getCommentGoal(post: Post): number {
  if (post.kind === 'media') return post.commentGoal || post.stats.comments || 0
  return post.commentGoal ?? post.stats.comments ?? 0
}
