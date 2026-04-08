import Link from 'next/link'
import styles from './StatCard.module.css'

type Color = 'yellow' | 'red' | 'green' | 'blue'

interface StatCardProps {
  label: string
  value: number
  href: string
  color?: Color
}

export default function StatCard({ label, value, href, color = 'blue' }: StatCardProps) {
  return (
    <Link href={href} className={styles.card}>
      <p className={styles.label}>{label}</p>
      <p className={`${styles.value} ${styles[color]}`}>{value}</p>
    </Link>
  )
}
