import Link from 'next/link'
import styles from './Header.module.css'

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          가챠맵
        </Link>
        <nav className={styles.nav}>
          <Link href="/search" className={styles.navLink}>검색</Link>
          <Link href="/wishlist" className={styles.navLink}>찜</Link>
          <Link href="/report" className={styles.navLink}>제보</Link>
        </nav>
      </div>
    </header>
  )
}
