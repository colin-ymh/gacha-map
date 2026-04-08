import { createAdminClient } from '@/lib/supabase/server'
import ShopAdminTable from '@/components/organisms/ShopAdminTable/ShopAdminTable'
import type { Shop, ShopStatus } from '@/types'
import styles from './page.module.css'

interface Props {
  searchParams: Promise<{ status?: ShopStatus }>
}

const STATUS_LABELS: Record<ShopStatus, string> = {
  pending: '대기',
  approved: '승인',
  rejected: '반려',
}

export default async function AdminShopsPage({ searchParams }: Props) {
  const { status = 'pending' } = await searchParams
  const supabase = await createAdminClient()

  const { data: shops } = await supabase
    .from('shops')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .returns<Shop[]>()

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>샵 관리</h1>
        <div className={styles.filters}>
          {(['pending', 'approved', 'rejected'] as ShopStatus[]).map((s) => (
            <a
              key={s}
              href={`?status=${s}`}
              className={`${styles.filterLink} ${status === s ? styles.active : styles.inactive}`}
            >
              {STATUS_LABELS[s]}
            </a>
          ))}
        </div>
      </div>
      <ShopAdminTable shops={shops ?? []} />
    </div>
  )
}
