import { createAdminClient } from '@/lib/supabase/server'
import ReportAdminTable from '@/components/organisms/ReportAdminTable/ReportAdminTable'
import type { Report } from '@/types'
import styles from './page.module.css'

export default async function AdminReportsPage() {
  const supabase = await createAdminClient()

  const { data: reports } = await supabase
    .from('reports')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .returns<Report[]>()

  return (
    <div>
      <h1 className={styles.title}>제보 검수</h1>
      <ReportAdminTable reports={reports ?? []} />
    </div>
  )
}
