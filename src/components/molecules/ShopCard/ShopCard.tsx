import Link from 'next/link'
import Tag from '@/components/atoms/Tag/Tag'
import type { Shop } from '@/types'
import styles from './ShopCard.module.css'

interface ShopCardProps {
  shop: Shop
  wishlisted?: boolean
  onWishlistToggle?: (shopId: string) => void
}

export default function ShopCard({ shop, wishlisted, onWishlistToggle }: ShopCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.body}>
        <Link href={`/shop/${shop.id}`} className={styles.link}>
          <h3 className={styles.name}>{shop.name}</h3>
          <p className={styles.address}>{shop.address}</p>
        </Link>
        {shop.tags.length > 0 && (
          <div className={styles.tags}>
            {shop.tags.map((tag) => (
              <Tag key={tag} label={tag} />
            ))}
          </div>
        )}
      </div>
      {onWishlistToggle && (
        <button
          className={styles.wishlistBtn}
          onClick={() => onWishlistToggle(shop.id)}
          aria-label={wishlisted ? '찜 해제' : '찜하기'}
        >
          {wishlisted ? '❤️' : '🤍'}
        </button>
      )}
    </div>
  )
}
