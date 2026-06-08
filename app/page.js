'use client'
export const dynamic = 'force-dynamic';
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    getSession().then(session => {
      router.replace(session ? '/dashboard' : '/login')
    })
  }, [])
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0f172a', color:'#94a3b8', fontFamily:'system-ui' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:'48px', marginBottom:'16px' }}>⚙️</div>
        <p>Carregando EquipCare Pro...</p>
      </div>
    </div>
  )
}
