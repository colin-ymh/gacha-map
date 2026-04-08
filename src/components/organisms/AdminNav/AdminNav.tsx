import Link from 'next/link'
import styles from './AdminNav.module.css'

export default function AdminNav() {
  return (
    <nav className={styles.nav}>
      <p className={styles.title}>가챠맵 관리자</p>
      <Link href="/admin/shops" className={styles.link}>샵 관리</Link>
      <Link href="/admin/reports" className={styles.link}>제보 검수</Link>
      <Link href="/admin/duplicates" className={styles.link}>중복 후보</Link>
      <Link href="/admin/logs" className={styles.link}>수집 로그</Link>
      <div className={styles.footer}>
        <Link href="/" className={styles.backLink}>← 사용자 페이지</Link>
      </div>
    </nav>
  )
}
