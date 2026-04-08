import AdminNav from '@/components/organisms/AdminNav/AdminNav'
import styles from './layout.module.css'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.layout}>
      <AdminNav />
      <main className={styles.main}>{children}</main>
    </div>
  )
}
