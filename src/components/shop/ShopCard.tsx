import Link from 'next/link'
import type { Shop } from '@/types'

interface ShopCardProps {
  shop: Shop
  wishlisted?: boolean
  onWishlistToggle?: (shopId: string) => void
}

export default function ShopCard({ shop, wishlisted, onWishlistToggle }: ShopCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex gap-3">
      <div className="flex-1 min-w-0">
        <Link href={`/shop/${shop.id}`} className="block">
          <h3 className="font-semibold text-gray-900 truncate hover:text-blue-600">
            {shop.name}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5 truncate">{shop.address}</p>
        </Link>
        <div className="flex flex-wrap gap-1 mt-2">
          {shop.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs bg-blue-50 text-blue-600 rounded-full px-2 py-0.5"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>
      {onWishlistToggle && (
        <button
          onClick={() => onWishlistToggle(shop.id)}
          className="text-xl flex-shrink-0 self-start"
          aria-label={wishlisted ? '찜 해제' : '찜하기'}
        >
          {wishlisted ? '❤️' : '🤍'}
        </button>
      )}
    </div>
  )
}
