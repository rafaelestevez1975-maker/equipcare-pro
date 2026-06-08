'use client'
export const dynamic = 'force-dynamic';
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getClient } from '@/lib/supabase'

function InviteForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    // Supabase puts the token in the URL hash for invites
    getClient().auth.getUser().then(({ data }) => {
      if (data?.user?.user_metadata?.name) setName(data.user.user_metadata.name)
    })
  }, [])

  async function handleSet(e) {
    e.preventDefault()
    if (pass !== pass2) { setError('As senhas não coincidem.'); return }
    if (pass.length < 6) { setError('Senha deve ter pelo menos 6 caracteres.'); return }
    setLoading(true)
    const { error } = await getClient().auth.updateUser({ password: pass })
    if (error) { setError(error.message); setLoading(false) }
    else router.replace('/dashboard')
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>
          <div style={{ fontSize:'52px' }}>🔑</div>
          <h1 style={s.h1}>Bem-vindo ao EquipCare Pro</h1>
          {name && <p style={s.sub}>Olá, <strong style={{ color:'#a5b4fc' }}>{name}</strong>! Defina sua senha para acessar o sistema.</p>}
          {!name && <p style={s.sub}>Defina sua senha para ativar seu acesso.</p>}
        </div>
        <form onSubmit={handleSet}>
          <div style={s.field}>
            <label style={s.label}>Nova Senha</label>
            <input style={s.input} type="password" placeholder="Mínimo 6 caracteres" value={pass}
              onChange={e => setPass(e.target.value)} required autoFocus />
          </div>
          <div style={s.field}>
            <label style={s.label}>Confirmar Senha</label>
            <input style={s.input} type="password" placeholder="Repita a senha" value={pass2}
              onChange={e => setPass2(e.target.value)} required />
          </div>
          {error && <p style={s.err}>{error}</p>}
          <button style={{ ...s.btn, opacity: loading ? .7 : 1 }} type="submit" disabled={loading}>
            {loading ? '⏳ Ativando...' : '✅ Ativar Meu Acesso'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function InvitePage() {
  return <Suspense fallback={<div style={{ color:'#fff', textAlign:'center', padding:'100px', fontFamily:'system-ui' }}>Carregando...</div>}>
    <InviteForm />
  </Suspense>
}

const s = {
  page: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
    background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)', padding:'20px' },
  card: { background:'#1e293b', border:'1px solid #334155', borderRadius:'20px',
    padding:'48px 40px', width:'100%', maxWidth:'420px', boxShadow:'0 25px 50px rgba(0,0,0,.6)' },
  logo: { textAlign:'center', marginBottom:'32px' },
  h1: { fontSize:'22px', fontWeight:'800', color:'#a5b4fc', margin:'8px 0 8px' },
  sub: { color:'#94a3b8', fontSize:'13px', margin:0, lineHeight:'1.5' },
  field: { marginBottom:'20px' },
  label: { display:'block', fontSize:'12px', fontWeight:'600', color:'#94a3b8', marginBottom:'8px' },
  input: { width:'100%', padding:'12px 16px', borderRadius:'10px', background:'#334155',
    border:'1.5px solid #334155', color:'#f1f5f9', fontSize:'14px', outline:'none',
    boxSizing:'border-box', fontFamily:'system-ui' },
  err: { color:'#f87171', fontSize:'13px', textAlign:'center', marginBottom:'12px' },
  btn: { width:'100%', padding:'14px', borderRadius:'10px', border:'none', cursor:'pointer',
    background:'linear-gradient(135deg,#10b981,#0ea5e9)', color:'#fff',
    fontSize:'15px', fontWeight:'700', letterSpacing:'.5px' }
}
