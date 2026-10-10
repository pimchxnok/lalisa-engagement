import type { Post } from './types'

export function getCommentGoal(post: Post): number {
  if (post.kind === 'media') return post.stats.comments ?? 0
  return post.commentGoal ?? post.stats.comments ?? 0
}
