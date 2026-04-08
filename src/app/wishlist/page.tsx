import { createClient } from '@/lib/supabase/server'
import PageShell from '@/components/templates/PageShell/PageShell'
import ShopList from '@/components/organisms/ShopList/ShopList'
import type { Shop } from '@/types'
import styles from './page.module.css'

export default async function WishlistPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <PageShell>
        <p className={styles.loginPrompt}>찜 목록을 보려면 로그인이 필요합니다</p>
      </PageShell>
    )
  }

  const { data: wishlists } = await supabase
    .from('wishlists')
    .select('shop_id, shops(*)')
    .eq('user_id', user.id)

  const shops: Shop[] = (wishlists ?? [])
    .map((w: Record<string, unknown>) => w.shops as Shop)
    .filter(Boolean)

  return (
    <PageShell>
      <h1 className={styles.title}>찜한 가챠샵</h1>
      <ShopList shops={shops} emptyMessage="찜한 샵이 없습니다" />
    </PageShell>
  )
}
