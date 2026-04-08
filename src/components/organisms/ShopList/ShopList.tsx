import ShopCard from '@/components/molecules/ShopCard/ShopCard'
import type { Shop } from '@/types'
import styles from './ShopList.module.css'

interface ShopListProps {
  shops: Shop[]
  emptyMessage?: string
  showCount?: boolean
  wishlisted?: Set<string>
  onWishlistToggle?: (shopId: string) => void
}

export default function ShopList({
  shops,
  emptyMessage = '등록된 가챠샵이 없습니다',
  showCount = false,
  wishlisted,
  onWishlistToggle,
}: ShopListProps) {
  return (
    <>
      {showCount && (
        <div className={styles.header}>
          <p className={styles.count}>가챠샵 {shops.length}개</p>
        </div>
      )}
      <ul className={styles.list}>
        {shops.map((shop) => (
          <li key={shop.id}>
            <ShopCard
              shop={shop}
              wishlisted={wishlisted?.has(shop.id)}
              onWishlistToggle={onWishlistToggle}
            />
          </li>
        ))}
        {shops.length === 0 && (
          <li className={styles.empty}>{emptyMessage}</li>
        )}
      </ul>
    </>
  )
}
