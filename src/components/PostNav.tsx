import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react'
import type { ListSearch } from '@/lib/filters'
import type { Post } from '@/lib/types'

/** Previous / next / back-to-list controls; "back" returns to the section list, not Home */
export function PostNav({ list, current, section, search }: { list: Post[]; current: Post; section: 'own' | 'media'; search: ListSearch }) {
  const i = list.findIndex((p) => p.id === current.id)
  const prev = i > 0 ? list[i - 1] : undefined
  const next = i >= 0 && i < list.length - 1 ? list[i + 1] : undefined
  const detail = section === 'media' ? '/media/$postId' : '/posts/$postId'
  const back = section === 'media' ? '/media' : '/posts'
  const btn = 'inline-flex items-center gap-1.5 rounded-full border border-gold-300 bg-white/60 px-4 py-2 text-sm text-gold-800 hover:bg-white'
  const off = 'inline-flex items-center gap-1.5 rounded-full border border-gold-200 px-4 py-2 text-sm text-gold-300 cursor-not-allowed'

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {prev ? (
        <Link to={detail} params={{ postId: prev.id }} search={search} className={btn}>
          <ChevronLeft className="size-4" /> Previous post
        </Link>
      ) : (
        <span className={off}><ChevronLeft className="size-4" /> Previous post</span>
      )}
      <Link to={back} search={search} className="btn-gold inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm">
        <LayoutGrid className="size-4" /> Back to {section === 'media' ? 'Media Post' : 'LISA & Brand Post'}
      </Link>
      {next ? (
        <Link to={detail} params={{ postId: next.id }} search={search} className={btn}>
          Next post <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span className={off}>Next post <ChevronRight className="size-4" /></span>
      )}
    </div>
  )
}
