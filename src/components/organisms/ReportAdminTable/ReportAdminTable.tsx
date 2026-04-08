'use client'

import { useState } from 'react'
import Button from '@/components/atoms/Button/Button'
import { createClient } from '@/lib/supabase/client'
import type { Report, ReportStatus } from '@/types'
import styles from './ReportAdminTable.module.css'

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
    return <p className={styles.empty}>검토할 제보가 없습니다</p>
  }

  return (
    <div className={styles.list}>
      {reports.map((report) => (
        <div key={report.id} className={styles.card}>
          <div className={styles.body}>
            <p className={styles.content}>{report.content}</p>
            <div className={styles.meta}>
              {report.reporter_name && <span>{report.reporter_name}</span>}
              {report.reporter_contact && <span>{report.reporter_contact}</span>}
              <span>{new Date(report.created_at).toLocaleDateString('ko-KR')}</span>
            </div>
          </div>
          <div className={styles.actions}>
            <Button size="sm" variant="info" onClick={() => updateStatus(report.id, 'reviewed')}>
              검토 완료
            </Button>
            <Button size="sm" variant="success" onClick={() => updateStatus(report.id, 'resolved')}>
              처리 완료
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
