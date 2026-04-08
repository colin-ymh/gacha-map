import { createAdminClient } from '@/lib/supabase/server'
import styles from './page.module.css'

export default async function AdminDuplicatesPage() {
  const supabase = await createAdminClient()

  const { data: candidates } = await supabase
    .from('duplicate_candidates')
    .select(`
      id,
      reviewed,
      created_at,
      shop_a:shops!shop_a_id(id, name, address),
      shop_b:shops!shop_b_id(id, name, address)
    `)
    .eq('reviewed', false)
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className={styles.title}>중복 후보 검수</h1>

      {(candidates ?? []).length === 0 ? (
        <p className={styles.empty}>검토할 중복 후보가 없습니다</p>
      ) : (
        <div className={styles.list}>
          {(candidates ?? []).map((c) => {
            type ShopRef = { id: string; name: string; address: string }
            const shopA = (Array.isArray(c.shop_a) ? c.shop_a[0] : c.shop_a) as ShopRef | null
            const shopB = (Array.isArray(c.shop_b) ? c.shop_b[0] : c.shop_b) as ShopRef | null
            return (
              <div key={c.id} className={styles.card}>
                <div>
                  <p className={styles.shopLabel}>샵 A</p>
                  <p className={styles.shopName}>{shopA?.name}</p>
                  <p className={styles.shopAddress}>{shopA?.address}</p>
                </div>
                <div>
                  <p className={styles.shopLabel}>샵 B</p>
                  <p className={styles.shopName}>{shopB?.name}</p>
                  <p className={styles.shopAddress}>{shopB?.address}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
