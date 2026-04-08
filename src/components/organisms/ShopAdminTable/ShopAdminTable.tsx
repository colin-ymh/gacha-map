'use client'

import { useState } from 'react'
import Button from '@/components/atoms/Button/Button'
import { createClient } from '@/lib/supabase/client'
import type { Shop, ShopStatus } from '@/types'
import styles from './ShopAdminTable.module.css'

interface Props {
  shops: Shop[]
}

export default function ShopAdminTable({ shops: initialShops }: Props) {
  const [shops, setShops] = useState(initialShops)
  const supabase = createClient()

  async function updateStatus(id: string, status: ShopStatus) {
    await supabase.from('shops').update({ status }).eq('id', id)
    setShops((prev) => prev.filter((s) => s.id !== id))
  }

  if (shops.length === 0) {
    return <p className={styles.empty}>항목이 없습니다</p>
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead className={styles.thead}>
          <tr>
            <th className={styles.th}>이름</th>
            <th className={styles.th}>주소</th>
            <th className={styles.th}>태그</th>
            <th className={styles.th}>등록일</th>
            <th className={styles.th} />
          </tr>
        </thead>
        <tbody>
          {shops.map((shop) => (
            <tr key={shop.id} className={styles.tr}>
              <td className={styles.td}>{shop.name}</td>
              <td className={`${styles.td} ${styles.tdMuted}`}>{shop.address}</td>
              <td className={`${styles.td} ${styles.tdMuted}`}>{shop.tags.join(', ')}</td>
              <td className={`${styles.td} ${styles.tdFaint}`}>
                {new Date(shop.created_at).toLocaleDateString('ko-KR')}
              </td>
              <td className={styles.td}>
                <div className={styles.actions}>
                  <Button size="sm" variant="success" onClick={() => updateStatus(shop.id, 'approved')}>
                    승인
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => updateStatus(shop.id, 'rejected')}>
                    반려
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
