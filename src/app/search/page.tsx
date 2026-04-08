import { createClient } from '@/lib/supabase/server'
import PageShell from '@/components/templates/PageShell/PageShell'
import SearchBar from '@/components/molecules/SearchBar/SearchBar'
import ShopList from '@/components/organisms/ShopList/ShopList'
import Tag from '@/components/atoms/Tag/Tag'
import type { Shop } from '@/types'
import styles from './page.module.css'

interface Props {
  searchParams: Promise<{ q?: string; tag?: string }>
}

export default async function SearchPage({ searchParams }: Props) {
  const { q, tag } = await searchParams
  const supabase = await createClient()

  let query = supabase.from('shops').select('*').eq('status', 'approved')
  if (q) query = query.or(`name.ilike.%${q}%,address.ilike.%${q}%`)
  if (tag) query = query.contains('tags', [tag])

  const { data: shops } = await query.returns<Shop[]>()

  return (
    <PageShell>
      <SearchBar defaultValue={q} />
      {tag && (
        <p className={styles.tagFilter}>
          태그: <Tag label={tag} />
        </p>
      )}
      <div className={styles.results}>
        <ShopList shops={shops ?? []} emptyMessage="검색 결과가 없습니다" />
      </div>
    </PageShell>
  )
}
