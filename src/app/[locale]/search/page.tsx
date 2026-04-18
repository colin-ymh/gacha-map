import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import PageShell from '@/components/templates/common/page-shell'
import SearchBar from '@/components/molecules/search/search-bar'
import ShopList from '@/components/organisms/common/shop-list'
import Tag from '@/components/atoms/common/tag'
import type { Shop } from '@/types'
import { TagFilter, Results } from './styles'

interface Props {
  searchParams: Promise<{ q?: string; tag?: string }>
}

export default async function SearchPage({ searchParams }: Props) {
  const { q, tag } = await searchParams
  const t = await getTranslations('search')

  const supabase = await createClient()

  let query = supabase.from('shops').select('*').eq('status', 'active')
  if (q) query = query.or(`name.ilike.%${q}%,address.ilike.%${q}%`)
  if (tag) query = query.contains('tags', [tag])

  const { data: shops } = await query.returns<Shop[]>()

  return (
    <PageShell>
      <SearchBar defaultValue={q} />
      {tag && (
        <TagFilter>
          {t('tagFilter')}: <Tag label={tag} />
        </TagFilter>
      )}
      <Results>
        <ShopList
          shops={shops ?? []}
          emptyMessage={t('empty')}
        />
      </Results>
    </PageShell>
  )
}
