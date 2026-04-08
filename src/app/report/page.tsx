'use client'

import { useState } from 'react'
import PageShell from '@/components/templates/PageShell/PageShell'
import Input from '@/components/atoms/Input/Input'
import Textarea from '@/components/atoms/Textarea/Textarea'
import Button from '@/components/atoms/Button/Button'
import { createClient } from '@/lib/supabase/client'
import styles from './page.module.css'

export default function ReportPage() {
  const [form, setForm] = useState({ reporter_name: '', reporter_contact: '', content: '' })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.content.trim()) return
    setSubmitting(true)
    const supabase = createClient()
    await supabase.from('reports').insert({
      reporter_name: form.reporter_name || null,
      reporter_contact: form.reporter_contact || null,
      content: form.content,
    })
    setDone(true)
    setSubmitting(false)
  }

  return (
    <PageShell>
      <h1 className={styles.title}>가챠샵 제보하기</h1>

      {done ? (
        <div className={styles.success}>
          <span className={styles.successEmoji}>감사합니다!</span>
          <p className={styles.successSub}>제보가 접수되었습니다. 검토 후 반영될 예정입니다.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>이름 (선택)</label>
            <Input
              value={form.reporter_name}
              onChange={(e) => setForm({ ...form, reporter_name: e.target.value })}
              placeholder="홍길동"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>연락처 (선택)</label>
            <Input
              value={form.reporter_contact}
              onChange={(e) => setForm({ ...form, reporter_contact: e.target.value })}
              placeholder="이메일 또는 전화번호"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              제보 내용 <span className={styles.required}>*</span>
            </label>
            <Textarea
              required
              rows={5}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="샵 이름, 주소, 특징 등을 알려주세요"
            />
          </div>
          <Button type="submit" disabled={submitting} fullWidth>
            {submitting ? '제출 중...' : '제보 제출'}
          </Button>
        </form>
      )}
    </PageShell>
  )
}
