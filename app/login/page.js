'use client'
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, getSession, getClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab]       = useState('login')   // 'login' | 'register'
  const [email, setEmail]   = useState('')
  const [pass, setPass]     = useState('')
  const [name, setName]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [ok, setOk]         = useState('')

  useEffect(() => {
    getSession().then(s => { if (s) router.replace('/dashboard') })
  }, [])

  async function handleLogin(e) {
    e?.preventDefault()
    setLoading(true); setError(''); setOk('')
    const { error } = await signIn(email, pass)
    if (error) { setError('E-mail ou senha incorretos.'); setLoading(false) }
    else router.replace('/dashboard')
  }

  async function handleRegister(e) {
    e?.preventDefault()
    if (!name.trim()) { setError('Digite seu nome completo.'); return }
    if (pass.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return }
    setLoading(true); setError(''); setOk('')

    const { data, error } = await getClient().auth.signUp({
      email,
      password: pass,
      options: { data: { name: name.trim(), pt_role: 'Operador', unit: '' } }
    })

    if (error) {
      setError(error.message.includes('already registered')
        ? 'Este e-mail já está cadastrado. Faça login.'
        : 'Erro ao criar conta: ' + error.message)
      setLoading(false)
      return
    }

    // Auto-confirmado — fazer login direto
    if (data?.session) {
      router.replace('/dashboard')
    } else {
      // Tentar login automático
      const { error: loginErr } = await signIn(email, pass)
      if (!loginErr) router.replace('/dashboard')
      else {
        setOk('✅ Conta criada! Faça login com seus dados.')
        setTab('login')
        setLoading(false)
      }
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>
          <div style={{ fontSize:'52px' }}>⚙️</div>
          <h1 style={s.h1}>EquipCare Pro</h1>
          <p style={s.sub}>Laser&amp;Co — Gestão de Equipamentos</p>
        </div>

        {/* Abas */}
        <div style={s.tabs}>
          <button style={{ ...s.tabBtn, ...(tab==='login'    ? s.tabActive : {}) }} onClick={() => { setTab('login');    setError(''); setOk('') }}>
            🔐 Entrar
          </button>
          <button style={{ ...s.tabBtn, ...(tab==='register' ? s.tabActive : {}) }} onClick={() => { setTab('register'); setError(''); setOk('') }}>
            ✏️ Criar Conta
          </button>
        </div>

        {/* LOGIN */}
        {tab === 'login' && (
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
            {ok    && <p style={s.suc}>{ok}</p>}
            <button style={{ ...s.btn, opacity: loading ? .7 : 1 }} type="submit" disabled={loading}>
              {loading ? '⏳ Entrando...' : '🔐 Entrar no Sistema'}
            </button>
          </form>
        )}

        {/* CADASTRO */}
        {tab === 'register' && (
          <form onSubmit={handleRegister}>
            <div style={s.field}>
              <label style={s.label}>Nome Completo</label>
              <input style={s.input} type="text" placeholder="Seu nome" value={name}
                onChange={e => setName(e.target.value)} required autoFocus />
            </div>
            <div style={s.field}>
              <label style={s.label}>E-mail</label>
              <input style={s.input} type="email" placeholder="seu@email.com" value={email}
                onChange={e => setEmail(e.target.value)} required />
            </div>
            <div style={s.field}>
              <label style={s.label}>Senha</label>
              <input style={s.input} type="password" placeholder="Mínimo 6 caracteres" value={pass}
                onChange={e => setPass(e.target.value)} required />
            </div>
            {error && <p style={s.err}>{error}</p>}
            <button style={{ ...s.btn, opacity: loading ? .7 : 1 }} type="submit" disabled={loading}>
              {loading ? '⏳ Criando conta...' : '✅ Criar Minha Conta'}
            </button>
            <p style={{ textAlign:'center', marginTop:'14px', fontSize:'12px', color:'#64748b' }}>
              Novos usuários entram como <strong style={{ color:'#94a3b8' }}>Operador</strong>.<br/>
              O administrador pode alterar o perfil depois.
            </p>
          </form>
        )}

        <p style={{ textAlign:'center', marginTop:'20px', fontSize:'11px', color:'#334155' }}>
          EquipCare Pro v2.0 • Acesso seguro
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
  logo: { textAlign:'center', marginBottom:'28px' },
  h1: { fontSize:'26px', fontWeight:'800', color:'#a5b4fc', margin:'8px 0 4px' },
  sub: { color:'#64748b', fontSize:'13px', margin:0 },
  tabs: { display:'flex', gap:'4px', background:'#0f172a', borderRadius:'10px',
    padding:'4px', marginBottom:'28px' },
  tabBtn: { flex:1, padding:'10px', border:'none', borderRadius:'8px', cursor:'pointer',
    fontSize:'13px', fontWeight:'600', color:'#64748b', background:'transparent',
    transition:'all .2s' },
  tabActive: { background:'#6366f1', color:'#fff', boxShadow:'0 2px 8px rgba(99,102,241,.4)' },
  field: { marginBottom:'18px' },
  label: { display:'block', fontSize:'12px', fontWeight:'600', color:'#94a3b8', marginBottom:'8px' },
  input: { width:'100%', padding:'12px 16px', borderRadius:'10px', background:'#334155',
    border:'1.5px solid #334155', color:'#f1f5f9', fontSize:'14px', outline:'none',
    boxSizing:'border-box', fontFamily:'system-ui' },
  err: { color:'#f87171', fontSize:'13px', textAlign:'center', marginBottom:'12px', margin:'0 0 12px' },
  suc: { color:'#34d399', fontSize:'13px', textAlign:'center', marginBottom:'12px', margin:'0 0 12px' },
  btn: { width:'100%', padding:'14px', borderRadius:'10px', border:'none', cursor:'pointer',
    background:'linear-gradient(135deg,#6366f1,#0ea5e9)', color:'#fff',
    fontSize:'15px', fontWeight:'700', letterSpacing:'.5px', transition:'opacity .2s' }
}
