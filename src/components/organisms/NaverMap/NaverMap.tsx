'use client'

import { useEffect, useRef, useState } from 'react'
import type { Shop } from '@/types'
import styles from './NaverMap.module.css'

interface NaverMapProps {
  shops: Shop[]
  onShopClick?: (shop: Shop) => void
  center?: { lat: number; lng: number }
  zoom?: number
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    naver: any
  }
}

export default function NaverMap({
  shops,
  onShopClick,
  center = { lat: 37.5665, lng: 126.978 },
  zoom = 13,
}: NaverMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (window.naver?.maps) { setReady(true); return }
    const interval = setInterval(() => {
      if (window.naver?.maps) { setReady(true); clearInterval(interval) }
    }, 100)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!ready || !mapRef.current || mapInstanceRef.current) return
    mapInstanceRef.current = new window.naver.maps.Map(mapRef.current, {
      center: new window.naver.maps.LatLng(center.lat, center.lng),
      zoom,
    })
  }, [ready, center.lat, center.lng, zoom])

  useEffect(() => {
    if (!mapInstanceRef.current) return
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    shops.forEach((shop) => {
      const marker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(shop.lat, shop.lng),
        map: mapInstanceRef.current,
        title: shop.name,
      })
      if (onShopClick) {
        window.naver.maps.Event.addListener(marker, 'click', () => onShopClick(shop))
      }
      markersRef.current.push(marker)
    })
  }, [shops, onShopClick, ready])

  return (
    <div className={styles.container}>
      <div ref={mapRef} className={styles.map} />
      {!ready && <div className={styles.loading}>지도 로딩 중...</div>}
    </div>
  )
}
