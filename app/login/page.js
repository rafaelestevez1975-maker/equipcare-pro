'use client'
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, getSession } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getSession().then(s => { if (s) router.replace('/dashboard') })
  }, [])

  async function handleLogin(e) {
    e?.preventDefault()
    setLoading(true); setError('')
    const { error } = await signIn(email, pass)
    if (error) { setError('E-mail ou senha incorretos.'); setLoading(false) }
    else router.replace('/dashboard')
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>
          <div style={{ fontSize:'52px' }}>⚙️</div>
          <h1 style={s.h1}>EquipCare Pro</h1>
          <p style={s.sub}>Sistema de Gestão de Máquinas e Equipamentos</p>
        </div>
        <form onSubmit={handleLogin}>
          <div style={s.field}>
            <label style={s.label}>E-mail</label>
            <input style={s.input} type="email" placeholder="seu@email.com" value={email}
              onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <div style={s.field}>
            <label style={s.label}>Senha</label>
            <input style={s.input} type="password" placeholder="••••••••" value={pass}
              onChange={e => setPass(e.target.value)} required />
          </div>
          {error && <p style={s.err}>{error}</p>}
          <button style={{ ...s.btn, opacity: loading ? .7 : 1 }} type="submit" disabled={loading}>
            {loading ? '⏳ Entrando...' : '🔐 Entrar no Sistema'}
          </button>
        </form>
        <p style={{ textAlign:'center', marginTop:'20px', fontSize:'12px', color:'#475569' }}>
          EquipCare Pro v2.0 • Acesso seguro via Supabase
        </p>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
    background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)', padding:'20px' },
  card: { background:'#1e293b', border:'1px solid #334155', borderRadius:'20px',
    padding:'48px 40px', width:'100%', maxWidth:'420px',
    boxShadow:'0 25px 50px rgba(0,0,0,.6)' },
  logo: { textAlign:'center', marginBottom:'32px' },
  h1: { fontSize:'26px', fontWeight:'800', color:'#a5b4fc', margin:'8px 0 4px' },
  sub: { color:'#64748b', fontSize:'13px', margin:0 },
  field: { marginBottom:'20px' },
  label: { display:'block', fontSize:'12px', fontWeight:'600', color:'#94a3b8', marginBottom:'8px' },
  input: { width:'100%', padding:'12px 16px', borderRadius:'10px', background:'#334155',
    border:'1.5px solid #334155', color:'#f1f5f9', fontSize:'14px', outline:'none',
    boxSizing:'border-box', transition:'border-color .2s',
    fontFamily:'system-ui' },
  err: { color:'#f87171', fontSize:'13px', textAlign:'center', marginBottom:'12px' },
  btn: { width:'100%', padding:'14px', borderRadius:'10px', border:'none', cursor:'pointer',
    background:'linear-gradient(135deg,#6366f1,#0ea5e9)', color:'#fff',
    fontSize:'15px', fontWeight:'700', letterSpacing:'.5px', transition:'opacity .2s' }
}
