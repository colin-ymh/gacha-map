'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Report, ReportStatus } from '@/types'

interface Props {
  reports: Report[]
}

export default function ReportAdminTable({ reports: initialReports }: Props) {
  const [reports, setReports] = useState(initialReports)
  const supabase = createClient()

  async function updateStatus(id: string, status: ReportStatus) {
    await supabase.from('reports').update({ status }).eq('id', id)
    setReports((prev) => prev.filter((r) => r.id !== id))
  }

  if (reports.length === 0) {
    return <p className="text-gray-400 text-sm py-10 text-center">검토할 제보가 없습니다</p>
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <div
          key={report.id}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm text-gray-900 leading-relaxed">{report.content}</p>
              <div className="flex gap-4 mt-2 text-xs text-gray-400">
                {report.reporter_name && <span>{report.reporter_name}</span>}
                {report.reporter_contact && <span>{report.reporter_contact}</span>}
                <span>{new Date(report.created_at).toLocaleDateString('ko-KR')}</span>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => updateStatus(report.id, 'reviewed')}
                className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded px-2.5 py-1 font-medium"
              >
                검토 완료
              </button>
              <button
                onClick={() => updateStatus(report.id, 'resolved')}
                className="text-xs bg-green-50 text-green-700 hover:bg-green-100 rounded px-2.5 py-1 font-medium"
              >
                처리 완료
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
