'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Header from '@/components/organisms/Header/Header'
import ShopList from '@/components/organisms/ShopList/ShopList'
import ShopCard from '@/components/molecules/ShopCard/ShopCard'
import type { Shop } from '@/types'
import styles from './MapClient.module.css'

const NaverMap = dynamic(() => import('@/components/organisms/NaverMap/NaverMap'), { ssr: false })

export default function MapClient({ shops }: { shops: Shop[] }) {
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null)

  const handleShopClick = useCallback((shop: Shop) => {
    setSelectedShop(shop)
  }, [])

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <div className={styles.mapArea}>
          <NaverMap shops={shops} onShopClick={handleShopClick} />
        </div>
        <aside className={styles.sidebar}>
          <ShopList shops={shops} showCount />
        </aside>
      </div>
      {selectedShop && (
        <div className={styles.bottomSheet}>
          <ShopCard shop={selectedShop} />
        </div>
      )}
    </div>
  )
}
