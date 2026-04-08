'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Shop, ShopStatus } from '@/types'

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
    return <p className="text-gray-400 text-sm py-10 text-center">항목이 없습니다</p>
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">이름</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">주소</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">태그</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">등록일</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {shops.map((shop) => (
            <tr key={shop.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium">{shop.name}</td>
              <td className="px-4 py-3 text-gray-500">{shop.address}</td>
              <td className="px-4 py-3 text-gray-500">{shop.tags.join(', ')}</td>
              <td className="px-4 py-3 text-gray-400">
                {new Date(shop.created_at).toLocaleDateString('ko-KR')}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => updateStatus(shop.id, 'approved')}
                    className="text-xs bg-green-50 text-green-700 hover:bg-green-100 rounded px-2.5 py-1 font-medium"
                  >
                    승인
                  </button>
                  <button
                    onClick={() => updateStatus(shop.id, 'rejected')}
                    className="text-xs bg-red-50 text-red-700 hover:bg-red-100 rounded px-2.5 py-1 font-medium"
                  >
                    반려
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
