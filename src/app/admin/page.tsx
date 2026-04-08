import { createAdminClient } from '@/lib/supabase/server'
import StatCard from '@/components/molecules/StatCard/StatCard'
import styles from './page.module.css'

export default async function AdminDashboard() {
  const supabase = await createAdminClient()

  const [
    { count: pendingShops },
    { count: pendingReports },
    { count: totalShops },
  ] = await Promise.all([
    supabase.from('shops').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('shops').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
  ])

  return (
    <div>
      <h1 className={styles.title}>대시보드</h1>
      <div className={styles.grid}>
        <StatCard label="승인 대기 샵" value={pendingShops ?? 0} href="/admin/shops?status=pending" color="yellow" />
        <StatCard label="미검토 제보" value={pendingReports ?? 0} href="/admin/reports" color="red" />
        <StatCard label="전체 승인 샵" value={totalShops ?? 0} href="/admin/shops?status=approved" color="green" />
      </div>
    </div>
  )
}
