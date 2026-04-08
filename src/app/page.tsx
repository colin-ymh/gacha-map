import { createClient } from '@/lib/supabase/server'
import type { Shop } from '@/types'
import MapClient from './MapClient'

export default async function HomePage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  const shops: Shop[] = error ? [] : (data ?? [])

  return <MapClient shops={shops} />
}
