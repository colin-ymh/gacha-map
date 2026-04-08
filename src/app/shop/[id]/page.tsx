import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PageShell from '@/components/templates/PageShell/PageShell'
import Tag from '@/components/atoms/Tag/Tag'
import type { Shop } from '@/types'
import styles from './page.module.css'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ShopDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: shop } = await supabase
    .from('shops')
    .select('*')
    .eq('id', id)
    .eq('status', 'approved')
    .single<Shop>()

  if (!shop) notFound()

  return (
    <PageShell>
      <h1 className={styles.name}>{shop.name}</h1>
      <p className={styles.address}>{shop.address}</p>

      {shop.description && (
        <p className={styles.description}>{shop.description}</p>
      )}

      {shop.tags.length > 0 && (
        <div className={styles.tags}>
          {shop.tags.map((tag) => (
            <Tag key={tag} label={tag} />
          ))}
        </div>
      )}

      {shop.image_urls.length > 0 && (
        <div className={styles.gallery}>
          {shop.image_urls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt={`${shop.name} 이미지 ${i + 1}`}
              className={styles.image}
            />
          ))}
        </div>
      )}
    </PageShell>
  )
}
