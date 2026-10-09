type MetricKey = keyof Stats

export function getCommentGoal(post: Post): number {
  if (post.kind === 'media') return post.stats.comments ?? 0
  return post.commentGoal ?? post.stats.comments ?? 0
}
