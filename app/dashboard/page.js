'use client'
export const dynamic = 'force-dynamic';
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getClient, signOut, db } from '@/lib/supabase'

// ─── helpers ───────────────────────────────────────────────
const fmt = (v) => 'R$ ' + (parseFloat(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:2})
const fmtDate = (d) => { if(!d) return '—'; const dt=new Date(d+'T00:00:00'); return dt.toLocaleDateString('pt-BR') }
const uid = () => crypto.randomUUID()
const today = () => new Date().toISOString().split('T')[0]
const statusColor = (s) => ({Operando:'#10b981',Manutenção:'#f59e0b',Inativo:'#ef4444',Estoque:'#8b5cf6',
  Concluída:'#10b981',Aberta:'#6366f1','Em Andamento':'#f59e0b',Cancelada:'#ef4444'}[s]||'#64748b')
const badgeCls = (s) => ({Operando:'success',Manutenção:'warning',Inativo:'danger',Estoque:'info',
  Concluída:'success',Aberta:'blue','Em Andamento':'warning',Cancelada:'danger',
  Ativo:'success',Inativo_:'danger',Administrador:'danger',Técnico:'warning',Operador:'blue',Visualizador:'gray'}[s]||'gray')

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState({show:false,msg:'',err:false})

  // Data states
  const [equipment, setEquipment] = useState([])
  const [orders, setOrders]       = useState([])
  const [stops, setStops]         = useState([])
  const [logistics, setLogistics] = useState([])
  const [vendors, setVendors]     = useState([])
  const [expenses, setExpenses]   = useState([])
  const [auditLog, setAuditLog]   = useState([])
  const [profiles, setProfiles]   = useState([])

  // Modal/form state
  const [modal, setModal] = useState(null)
  const [form, setForm]   = useState({})
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [maintTab, setMaintTab] = useState('prev')
  const [calYear, setCalYear]   = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [inviteLink, setInviteLink] = useState('')

  // ── Auth ───────────────────────────────────────────────
  useEffect(() => {
    getClient().auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      setUser(session.user)
      loadAll(session.user)
    })
    const { data: { subscription } } = getClient().auth.onAuthStateChange((event, session) => {
      if (!session) router.replace('/login')
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadAll(u) {
    setLoading(true)
    const [eq, or, st, lo, ve, ex, au, pr] = await Promise.all([
      db.equipment.getAll(), db.orders.getAll(), db.stops.getAll(),
      db.logistics.getAll(), db.vendors.getAll(), db.expenses.getAll(),
      db.audit.getAll(), db.profiles.getAll()
    ])
    setEquipment(eq.data || [])
    setOrders(or.data || [])
    setStops(st.data || [])
    setLogistics(lo.data || [])
    setVendors(ve.data || [])
    setExpenses(ex.data || [])
    setAuditLog(au.data || [])
    setProfiles(pr.data || [])
    // load own profile
    const { data: prof } = await getClient().from('profiles').select('*').eq('id', u.id).single()
    setProfile(prof)
    setLoading(false)
  }

  const reload = () => loadAll(user)

  async function addAudit(action, module, detail) {
    await db.audit.insert({ user_id: user?.id, user_name: profile?.name || user?.email, action, module, detail })
  }

  function showToast(msg, err=false) {
    setToast({show:true,msg,err})
    setTimeout(()=>setToast({show:false,msg:'',err:false}),3000)
  }

  async function doLogout() {
    await addAudit('Logout','Autenticação','Saída do sistema')
    await signOut()
    router.replace('/login')
  }

  // ── CRUD helpers ───────────────────────────────────────
  async function saveEquipment() {
    const data = {
      brand: form.brand, model: form.model, serial: form.serial, type: form.type,
      location: form.location, availability: form.availability, status: form.status,
      acquisition_date: form.acquisition_date || null, notes: form.notes, created_by: user.id
    }
    if (!data.brand || !data.model) { showToast('Preencha marca e modelo.',true); return }
    if (form.id) {
      await db.equipment.update(form.id, data)
      await addAudit('Editou','Inventário',`${data.brand} ${data.model}`)
      showToast('Equipamento atualizado!')
    } else {
      await db.equipment.insert(data)
      await addAudit('Adicionou','Inventário',`${data.brand} ${data.model}`)
      showToast('Equipamento adicionado!')
    }
    setModal(null); reload()
  }

  async function deleteEquipment(id, name) {
    if (!confirm(`Remover ${name}?`)) return
    await db.equipment.delete(id)
    await addAudit('Removeu','Inventário',name)
    showToast('Equipamento removido.'); reload()
  }

  async function saveOrder() {
    const data = {
      equip_id: form.equip_id, type: form.type, tech: form.tech,
      open_date: form.open_date || today(), cost: parseFloat(form.cost)||0,
      status: form.status, description: form.description, created_by: user.id
    }
    if (!data.tech) { showToast('Informe o técnico.',true); return }
    if (form.id) {
      await db.orders.update(form.id, data)
      showToast('OS atualizada!')
    } else {
      await db.orders.insert(data)
      await addAudit('Criou OS','Manutenções',data.type)
      showToast('OS criada!')
    }
    setModal(null); reload()
  }

  async function deleteOrder(id) {
    if (!confirm('Remover esta OS?')) return
    await db.orders.delete(id); showToast('OS removida.'); reload()
  }

  async function saveStop() {
    await db.stops.insert({ equip_id: form.equip_id, start_date: form.start_date, end_date: form.end_date, reason: form.reason })
    await addAudit('Agendou Parada','Manutenções',`${form.start_date} → ${form.end_date}`)
    setModal(null); showToast('Parada agendada!'); reload()
  }

  async function saveLogistic() {
    await db.logistics.insert({ event_date: form.event_date, log_type: form.log_type, equip_id: form.equip_id||null, description: form.description })
    await addAudit('Adicionou Evento','Logística',form.log_type)
    setModal(null); showToast('Evento adicionado!'); reload()
  }

  async function saveVendor() {
    const data = { company: form.company, contact: form.contact, phone: form.phone, email: form.email, specialty: form.specialty, rating: form.rating||'5 ⭐', notes: form.notes }
    if (!data.company) { showToast('Informe o nome da empresa.',true); return }
    if (form.id) { await db.vendors.update(form.id, data); showToast('Fornecedor atualizado!') }
    else { await db.vendors.insert(data); await addAudit('Adicionou','Fornecedores',data.company); showToast('Fornecedor adicionado!') }
    setModal(null); reload()
  }

  async function deleteVendor(id, name) {
    if (!confirm(`Remover ${name}?`)) return
    await db.vendors.delete(id); showToast('Fornecedor removido.'); reload()
  }

  async function saveExpense() {
    if (!form.value) { showToast('Informe o valor.',true); return }
    await db.expenses.insert({ expense_date: form.expense_date || today(), equip_id: form.equip_id||null, category: form.category, value: parseFloat(form.value), description: form.description })
    await addAudit('Registrou Despesa','Financeiro', fmt(form.value))
    setModal(null); showToast('Despesa registrada!'); reload()
  }

  async function deleteExpense(id) {
    await db.expenses.delete(id); showToast('Despesa removida.'); reload()
  }

  // Invite user via Edge Function
  async function inviteUserAction() {
    if (!form.inv_email || !form.inv_name) { showToast('Preencha nome e e-mail.',true); return }
    try {
      const res = await fetch('https://riutcbwillvqjrpaefkb.supabase.co/functions/v1/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpdXRjYndpbGx2cWpycGFlZmtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NDk0MzksImV4cCI6MjA5MDMyNTQzOX0.WR69xD-_dvkG7dN2EkwerPw0Su8vcStNgnha8Ky0grA' },
        body: JSON.stringify({ email: form.inv_email, name: form.inv_name, role: form.inv_role||'Operador', unit: form.inv_unit||'' })
      })
      const json = await res.json()
      if (!res.ok || json.error) { showToast(json.error || 'Erro ao enviar convite.', true); return }
      showToast(`✉️ Convite enviado para ${form.inv_email}!`)
      setModal(null); reload()
    } catch(e) {
      showToast('Erro de conexão ao enviar convite.', true)
    }
  }

  // ── Computed ───────────────────────────────────────────
  const now = new Date()
  const openOrders = orders.filter(o => o.status === 'Aberta' || o.status === 'Em Andamento').length
  const opEquip = equipment.filter(e => e.status === 'Operando').length
  const monthExp = expenses.filter(e => {
    const d = new Date((e.expense_date||'')+'T00:00:00')
    return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear()
  }).reduce((s,e)=>s+(parseFloat(e.value)||0),0)

  const eqMap = Object.fromEntries(equipment.map(e=>[e.id, `${e.brand} ${e.model}`]))

  // Calendar
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  function calDays() {
    const first = new Date(calYear, calMonth, 1)
    const last  = new Date(calYear, calMonth+1, 0)
    const prevDays = new Date(calYear, calMonth, 0).getDate()
    const startDay = first.getDay()
    const days = []
    for (let i=startDay-1;i>=0;i--) days.push({d:prevDays-i,cur:false})
    for (let d=1;d<=last.getDate();d++) days.push({d,cur:true})
    const rem = 42 - days.length
    for (let d=1;d<=rem;d++) days.push({d,cur:false})
    return days
  }

  function calEventColor(type) {
    return {Entrega:'#10b981',Retirada:'#f59e0b',Manutenção:'#6366f1',Instalação:'#0ea5e9',Treinamento:'#8b5cf6'}[type]||'#6366f1'
  }

  const RAFAEL_ID = '5a4b91a1-8cb1-45fe-b4dc-b0da4dd0fe48'

  async function deleteUser(profileId, profileName) {
    if (profileId === RAFAEL_ID) { showToast('O administrador Rafael não pode ser excluído.', true); return }
    if (!confirm(`Excluir o usuário "${profileName}"? Esta ação não pode ser desfeita.`)) return
    // Delete from profiles (auth user deletion requires service role - mark inactive instead)
    await db.profiles.update(profileId, { status: 'Inativo', role: 'Visualizador' })
    await getClient().from('profiles').delete().eq('id', profileId)
    await addAudit('Exclusão', 'Usuários', `Usuário ${profileName} excluído`)
    reload(); showToast(`Usuário ${profileName} excluído!`)
  }

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#ffffff',color:'#475569',fontFamily:'system-ui'}}>
      <div style={{textAlign:'center'}}><div style={{fontSize:'48px',marginBottom:'16px'}}>⚙️</div><p>Carregando dados...</p></div>
    </div>
  )

  // ── RENDER ─────────────────────────────────────────────
  return (
    <div style={{fontFamily:'Segoe UI,system-ui,sans-serif',background:'#ffffff',minHeight:'100vh',color:'#1e293b'}}>
      <style>{CSS}</style>

      {/* SIDEBAR */}
      <nav className={`sidebar${sidebarOpen?'':' collapsed'}`}>
        <div className="sidebar-header">
          <span style={{fontSize:'28px'}}>⚙️</span>
          <div><div className="sidebar-title">EquipCare Pro</div><div className="sidebar-sub">v2.0 • Gestão Inteligente</div></div>
        </div>

        <div className="nav-section"><div className="nav-label">Menu Principal</div>
          {[['dashboard','📊','Dashboard'],['inventory','📦','Inventário'],['maintenance','🔩','Manutenções'],
            ['logistics','📅','Calendário de Logística'],['vendors','🏭','Fornecedores'],['financial','💰','Relatórios Financeiros']
          ].map(([id,icon,label])=>(
            <button key={id} className={`nav-item${page===id?' active':''}`} onClick={()=>setPage(id)}>
              <span className="nav-icon">{icon}</span> {label}
              {id==='maintenance' && openOrders>0 && <span className="nav-badge">{openOrders}</span>}
            </button>
          ))}
        </div>

        <div className="nav-section"><div className="nav-label">Administração</div>
          {[['users','👥','Gestão de Usuários'],['audit','📋','Auditoria de Ações']].map(([id,icon,label])=>(
            <button key={id} className={`nav-item${page===id?' active':''}`} onClick={()=>setPage(id)}>
              <span className="nav-icon">{icon}</span> {label}
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="user-avatar">{(profile?.name||user?.email||'U').slice(0,2).toUpperCase()}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:'13px',fontWeight:'600',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{profile?.name||user?.email}</div>
            <div style={{fontSize:'11px',color:'#64748b'}}>{profile?.role||'Usuário'}</div>
          </div>
          <button className="logout-btn" onClick={doLogout}>Sair</button>
        </div>
      </nav>

      {/* HEADER */}
      <header className={`app-header${sidebarOpen?'':' full'}`}>
        <button className="toggle-btn" onClick={()=>setSidebarOpen(v=>!v)}>☰</button>
        <span style={{fontWeight:'700',fontSize:'17px',color:'#1e293b'}}>
          {{dashboard:'Dashboard',inventory:'Inventário de Equipamentos',maintenance:'Gestão de Manutenções',
            logistics:'Calendário de Logística',vendors:'Gestão de Fornecedores',financial:'Relatórios Financeiros',
            users:'Gestão de Usuários',audit:'Auditoria de Ações'}[page]}
        </span>
        <div className="header-search">
          <span style={{color:'#64748b'}}>🔍</span>
          <input placeholder="Buscar equipamento..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{background:'none',border:'none',outline:'none',color:'#1e293b',fontSize:'13px',width:'180px'}}/>
        </div>
        <button className="notif-btn" onClick={()=>setPage('maintenance')}>🔔{openOrders>0&&<span className="notif-dot"/>}</button>
      </header>

      {/* MAIN */}
      <main className={`app-main${sidebarOpen?'':' full'}`}>

        {/* ══ DASHBOARD ══ */}
        {page==='dashboard' && (
          <div>
            <div className="kpi-grid">
              <KPI icon="📦" value={equipment.length} label="Total de Equipamentos" sub="Registrados no sistema" color="#6366f1"/>
              <KPI icon="✅" value={equipment.length ? Math.round(opEquip/equipment.length*100)+'%' : '0%'} label="Status Operacional" sub={`${opEquip} de ${equipment.length} operando`} color="#10b981"/>
              <KPI icon="🔧" value={openOrders} label="Manutenções em Curso" sub="Aguardando finalização" color="#f59e0b"/>
              <KPI icon="💵" value={fmt(monthExp)} label="Gasto Total (Mês)" sub="Despesas registradas" color="#0ea5e9"/>
            </div>
            <div className="grid2">
              <Card title="🏥 Saúde da Frota" sub="Distribuição por status">
                {[['Operando','#10b981'],['Manutenção','#f59e0b'],['Inativo','#ef4444'],['Estoque','#8b5cf6']].map(([st,color])=>{
                  const n = equipment.filter(e=>e.status===st).length
                  const pct = equipment.length ? Math.round(n/equipment.length*100) : 0
                  return <div key={st} style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'12px'}}>
                    <span style={{width:'90px',fontSize:'12px',color:'#94a3b8'}}>{st}</span>
                    <div style={{flex:1,background:'#e2e8f0',borderRadius:'999px',height:'8px'}}>
                      <div style={{width:pct+'%',height:'100%',background:color,borderRadius:'999px',transition:'width .4s'}}/>
                    </div>
                    <span style={{width:'40px',textAlign:'right',fontSize:'12px',fontWeight:'700',color}}>{pct}%</span>
                  </div>
                })}
              </Card>
              <Card title="📍 Distribuição por Unidade" sub="Equipamentos por localização">
                {(() => {
                  const units = {}
                  equipment.forEach(e => { units[e.location||'—'] = (units[e.location||'—']||0)+1 })
                  const max = Math.max(...Object.values(units),1)
                  return Object.entries(units).length ? Object.entries(units).map(([u,c])=>(
                    <div key={u} style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'12px'}}>
                      <span style={{width:'110px',fontSize:'12px',color:'#94a3b8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u}</span>
                      <div style={{flex:1,background:'#e2e8f0',borderRadius:'999px',height:'8px'}}>
                        <div style={{width:Math.round(c/max*100)+'%',height:'100%',background:'#0ea5e9',borderRadius:'999px'}}/>
                      </div>
                      <span style={{width:'24px',textAlign:'right',fontSize:'12px',fontWeight:'700',color:'#0ea5e9'}}>{c}</span>
                    </div>
                  )) : <Empty icon="🏢" msg="Nenhum equipamento cadastrado"/>
                })()}
              </Card>
            </div>
            <Card title="⏱ Timeline de Manutenções">
              {orders.slice(0,6).length ? orders.slice(0,6).map(o=>(
                <div key={o.id} style={{display:'flex',gap:'16px',paddingBottom:'16px',borderBottom:'1px solid #e2e8f0'}}>
                  <div style={{width:'36px',height:'36px',borderRadius:'50%',background:statusColor(o.status)+'22',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>🔧</div>
                  <div>
                    <div style={{fontSize:'13px',fontWeight:'600'}}>{eqMap[o.equip_id]||'—'} — {o.type}</div>
                    <div style={{fontSize:'11px',color:'#64748b',marginTop:'2px'}}>
                      {o.tech} • {fmtDate(o.open_date)} • <Badge status={o.status}/>
                    </div>
                  </div>
                </div>
              )) : <Empty icon="📋" msg="Nenhuma manutenção registrada."/>}
            </Card>
          </div>
        )}

        {/* ══ INVENTÁRIO ══ */}
        {page==='inventory' && (
          <div>
            <div className="search-bar">
              <input className="search-input" placeholder="🔍 Buscar por marca, modelo ou serial..."
                value={search} onChange={e=>setSearch(e.target.value)}/>
              <select className="search-input" style={{maxWidth:'160px'}} value={filters.status||''} onChange={e=>setFilters(f=>({...f,status:e.target.value}))}>
                <option value="">Todos os Status</option>
                {['Operando','Manutenção','Inativo','Estoque'].map(s=><option key={s}>{s}</option>)}
              </select>
              <select className="search-input" style={{maxWidth:'140px'}} value={filters.type||''} onChange={e=>setFilters(f=>({...f,type:e.target.value}))}>
                <option value="">Todos os Tipos</option>
                {['Laser','Ultrassom','Estética','Diagnóstico','Outro'].map(t=><option key={t}>{t}</option>)}
              </select>
              <button className="btn btn-primary" onClick={()=>{setForm({type:'Laser',availability:'Estoque',status:'Operando',acquisition_date:today()});setModal('equip')}}>➕ Adicionar Equipamento</button>
            </div>
            <div className="card" style={{padding:0}}>
              <div className="table-wrap">
                <table><thead><tr>
                  <th>Equipamento</th><th>Nº de Série</th><th>Tipo</th>
                  <th>Localização</th><th>Disponibilidade</th><th>Status</th><th>Ações</th>
                </tr></thead><tbody>
                  {equipment.filter(e=>{
                    const q = search.toLowerCase()
                    const matchQ = (e.brand+e.model+e.serial+e.location).toLowerCase().includes(q)
                    const matchS = !filters.status || e.status===filters.status
                    const matchT = !filters.type || e.type===filters.type
                    return matchQ && matchS && matchT
                  }).map(e=>(
                    <tr key={e.id}>
                      <td><strong>{e.brand} {e.model}</strong></td>
                      <td className="muted">{e.serial}</td>
                      <td><span className="badge badge-blue">{e.type}</span></td>
                      <td className="muted">{e.location}</td>
                      <td><span className="badge badge-gray">{e.availability}</span></td>
                      <td><Badge status={e.status}/></td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={()=>{setForm({id:e.id,brand:e.brand,model:e.model,serial:e.serial,type:e.type,location:e.location,availability:e.availability,status:e.status,acquisition_date:e.acquisition_date,notes:e.notes});setModal('equip')}}>✏️</button>
                        <button className="btn btn-danger btn-sm" style={{marginLeft:'4px'}} onClick={()=>deleteEquipment(e.id,`${e.brand} ${e.model}`)}>🗑</button>
                      </td>
                    </tr>
                  ))}
                  {equipment.length===0 && <tr><td colSpan="7" style={{textAlign:'center',padding:'32px',color:'#64748b'}}>Nenhum equipamento cadastrado.</td></tr>}
                </tbody></table>
              </div>
            </div>
          </div>
        )}

        {/* ══ MANUTENÇÕES ══ */}
        {page==='maintenance' && (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px',flexWrap:'wrap',gap:'10px'}}>
              <p style={{fontSize:'13px',color:'#64748b',margin:0}}>Gerencie e acompanhe manutenções e preventivas.</p>
              <div style={{display:'flex',gap:'8px'}}>
                <button className="btn btn-outline">📄 Exportar PDF</button>
                <button className="btn btn-primary" onClick={()=>{setForm({type:'Preventiva',status:'Aberta',open_date:today(),equip_id:equipment[0]?.id||''});setModal('order')}}>➕ Nova OS</button>
              </div>
            </div>
            <div className="tabs">
              {[['prev','🛡 Preventivo'],['os','📋 Ordens de Serviço'],['stops','⏸ Paradas']].map(([id,label])=>(
                <button key={id} className={`tab-btn${maintTab===id?' active':''}`} onClick={()=>setMaintTab(id)}>{label}</button>
              ))}
            </div>

            {maintTab==='prev' && (
              <Card title="📡 Status Preventivo" sub="Agenda de manutenções preventivas"
                action={<button className="btn btn-warning btn-sm" onClick={()=>{setForm({equip_id:equipment[0]?.id||'',start_date:today(),end_date:today()});setModal('stop')}}>📅 Agendar Parada</button>}>
                <div className="table-wrap">
                  <table><thead><tr><th>Equipamento</th><th>Status</th><th>Próxima Manutenção</th><th>Alerta</th></tr></thead><tbody>
                    {equipment.map(e=>{
                      const last = orders.filter(o=>o.equip_id===e.id && o.type==='Preventiva').slice(-1)[0]
                      const next = last ? (() => { const d = new Date(last.open_date+'T00:00:00'); d.setMonth(d.getMonth()+6); return d })() : null
                      const late = next && next < new Date()
                      return <tr key={e.id}>
                        <td><strong>{e.brand} {e.model}</strong><br/><span style={{fontSize:'11px',color:'#64748b'}}>{e.serial}</span></td>
                        <td><span className={`badge badge-${late?'danger':'success'}`}>{late?'⚠ Vencida':'✅ Em Dia'}</span></td>
                        <td className="muted">{next ? next.toLocaleDateString('pt-BR') : '—'}</td>
                        <td><span className={`badge badge-${late?'warning':'gray'}`}>Normal</span></td>
                      </tr>
                    })}
                    {!equipment.length && <tr><td colSpan="4" style={{textAlign:'center',padding:'24px',color:'#64748b'}}>Nenhum equipamento.</td></tr>}
                  </tbody></table>
                </div>
              </Card>
            )}

            {maintTab==='os' && (
              <div>
                <div className="search-bar">
                  <input className="search-input" placeholder="🔍 Buscar OS..." value={search} onChange={e=>setSearch(e.target.value)}/>
                  <select className="search-input" style={{maxWidth:'160px'}} value={filters.osStatus||''} onChange={e=>setFilters(f=>({...f,osStatus:e.target.value}))}>
                    <option value="">Todos os Status</option>
                    {['Aberta','Em Andamento','Concluída','Cancelada'].map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="card" style={{padding:0}}>
                  <div className="table-wrap">
                    <table><thead><tr><th>#OS</th><th>Equipamento</th><th>Tipo</th><th>Técnico</th><th>Data</th><th>Custo</th><th>Status</th><th>Ações</th></tr></thead><tbody>
                      {orders.filter(o=>{
                        const eq = eqMap[o.equip_id]||''
                        const q = search.toLowerCase()
                        return (eq+o.tech+o.description).toLowerCase().includes(q) && (!filters.osStatus || o.status===filters.osStatus)
                      }).map((o,i)=>(
                        <tr key={o.id}>
                          <td className="muted">#{String(i+1).padStart(3,'0')}</td>
                          <td><strong>{eqMap[o.equip_id]||'—'}</strong></td>
                          <td><span className="badge badge-blue">{o.type}</span></td>
                          <td className="muted">{o.tech}</td>
                          <td className="muted">{fmtDate(o.open_date)}</td>
                          <td style={{color:'#f59e0b',fontWeight:'700'}}>{fmt(o.cost)}</td>
                          <td><Badge status={o.status}/></td>
                          <td>
                            <button className="btn btn-outline btn-sm" onClick={()=>{setForm({id:o.id,equip_id:o.equip_id,type:o.type,tech:o.tech,open_date:o.open_date,cost:o.cost,status:o.status,description:o.description});setModal('order')}}>✏️</button>
                            <button className="btn btn-danger btn-sm" style={{marginLeft:'4px'}} onClick={()=>deleteOrder(o.id)}>🗑</button>
                          </td>
                        </tr>
                      ))}
                      {!orders.length && <tr><td colSpan="8" style={{textAlign:'center',padding:'32px',color:'#64748b'}}>Nenhuma OS registrada.</td></tr>}
                    </tbody></table>
                  </div>
                </div>
              </div>
            )}

            {maintTab==='stops' && (
              <Card title="⏸ Paradas Programadas">
                <div className="table-wrap">
                  <table><thead><tr><th>Equipamento</th><th>Início</th><th>Fim</th><th>Motivo</th><th>Ações</th></tr></thead><tbody>
                    {stops.map(s=>(
                      <tr key={s.id}>
                        <td><strong>{eqMap[s.equip_id]||'—'}</strong></td>
                        <td className="muted">{fmtDate(s.start_date)}</td>
                        <td className="muted">{fmtDate(s.end_date)}</td>
                        <td className="muted">{s.reason}</td>
                        <td><button className="btn btn-danger btn-sm" onClick={async()=>{await db.stops.delete(s.id);reload();showToast('Parada removida.')}}>🗑</button></td>
                      </tr>
                    ))}
                    {!stops.length && <tr><td colSpan="5" style={{textAlign:'center',padding:'32px',color:'#64748b'}}>Nenhuma parada programada.</td></tr>}
                  </tbody></table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ══ LOGÍSTICA ══ */}
        {page==='logistics' && (
          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                <button className="btn btn-outline btn-sm" onClick={()=>{let m=calMonth-1,y=calYear;if(m<0){m=11;y--}setCalMonth(m);setCalYear(y)}}>‹</button>
                <span style={{fontWeight:'700',fontSize:'15px'}}>{months[calMonth]} {calYear}</span>
                <button className="btn btn-outline btn-sm" onClick={()=>{let m=calMonth+1,y=calYear;if(m>11){m=0;y++}setCalMonth(m);setCalYear(y)}}>›</button>
              </div>
              <button className="btn btn-primary" onClick={()=>{setForm({log_type:'Entrega',event_date:today(),equip_id:equipment[0]?.id||''});setModal('logistic')}}>➕ Novo Evento</button>
            </div>
            <div className="card">
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'4px',marginBottom:'4px'}}>
                {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=><div key={d} style={{textAlign:'center',fontSize:'11px',fontWeight:'700',color:'#64748b',padding:'6px 0'}}>{d}</div>)}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'4px'}}>
                {calDays().map((day,i)=>{
                  const dateStr = day.cur ? `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day.d).padStart(2,'0')}` : ''
                  const evs = logistics.filter(e=>e.event_date===dateStr)
                  const isToday = day.cur && day.d===now.getDate() && calMonth===now.getMonth() && calYear===now.getFullYear()
                  return <div key={i} style={{minHeight:'80px',background:isToday?'rgba(99,102,241,.08)':'#ffffff',border:`1px solid ${isToday?'#6366f1':'#e2e8f0'}`,borderRadius:'8px',padding:'6px',opacity:day.cur?1:.4}}>
                    <div style={{fontSize:'12px',fontWeight:'600',color:isToday?'#6366f1':'#64748b'}}>{day.d}</div>
                    {evs.slice(0,2).map(e=><div key={e.id} style={{fontSize:'10px',padding:'2px 4px',borderRadius:'4px',marginTop:'2px',background:calEventColor(e.log_type)+'22',color:calEventColor(e.log_type)}}>{e.log_type}</div>)}
                  </div>
                })}
              </div>
            </div>
            <Card title="📋 Eventos do Mês">
              <div className="table-wrap">
                <table><thead><tr><th>Data</th><th>Descrição</th><th>Equipamento</th><th>Tipo</th><th>Ações</th></tr></thead><tbody>
                  {logistics.filter(e=>{const d=new Date((e.event_date||'')+'T00:00:00');return d.getMonth()===calMonth&&d.getFullYear()===calYear}).map(e=>(
                    <tr key={e.id}>
                      <td className="muted">{fmtDate(e.event_date)}</td>
                      <td>{e.description}</td>
                      <td className="muted">{eqMap[e.equip_id]||'—'}</td>
                      <td><span className="badge badge-blue">{e.log_type}</span></td>
                      <td><button className="btn btn-danger btn-sm" onClick={async()=>{await db.logistics.delete(e.id);reload();showToast('Evento removido.')}}>🗑</button></td>
                    </tr>
                  ))}
                  {!logistics.filter(e=>{const d=new Date((e.event_date||'')+'T00:00:00');return d.getMonth()===calMonth&&d.getFullYear()===calYear}).length &&
                    <tr><td colSpan="5" style={{textAlign:'center',padding:'24px',color:'#64748b'}}>Nenhum evento este mês.</td></tr>}
                </tbody></table>
              </div>
            </Card>
          </div>
        )}

        {/* ══ FORNECEDORES ══ */}
        {page==='vendors' && (
          <div>
            <div className="search-bar">
              <input className="search-input" placeholder="🔍 Buscar por empresa, serviço ou contato..." value={search} onChange={e=>setSearch(e.target.value)}/>
              <button className="btn btn-primary" onClick={()=>{setForm({rating:'5 ⭐'});setModal('vendor')}}>➕ Novo Fornecedor</button>
            </div>
            <div className="card" style={{padding:0}}>
              <div className="table-wrap">
                <table><thead><tr><th>Empresa</th><th>Contato</th><th>Telefone</th><th>E-mail</th><th>Especialidade</th><th>Avaliação</th><th>Ações</th></tr></thead><tbody>
                  {vendors.filter(v=>(v.company+v.contact+v.specialty).toLowerCase().includes(search.toLowerCase())).map(v=>(
                    <tr key={v.id}>
                      <td><strong>{v.company}</strong></td>
                      <td className="muted">{v.contact}</td>
                      <td className="muted">{v.phone}</td>
                      <td className="muted">{v.email}</td>
                      <td><span className="badge badge-blue">{v.specialty}</span></td>
                      <td>{v.rating}</td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={()=>{setForm({id:v.id,...v});setModal('vendor')}}>✏️</button>
                        <button className="btn btn-danger btn-sm" style={{marginLeft:'4px'}} onClick={()=>deleteVendor(v.id,v.company)}>🗑</button>
                      </td>
                    </tr>
                  ))}
                  {!vendors.length && <tr><td colSpan="7" style={{textAlign:'center',padding:'32px',color:'#64748b'}}>Nenhum fornecedor cadastrado.</td></tr>}
                </tbody></table>
              </div>
            </div>
          </div>
        )}

        {/* ══ FINANCEIRO ══ */}
        {page==='financial' && (
          <div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:'8px',marginBottom:'16px'}}>
              <button className="btn btn-primary" onClick={()=>{setForm({category:'Manutenção',expense_date:today(),equip_id:equipment[0]?.id||''});setModal('expense')}}>➕ Nova Despesa</button>
            </div>
            <div className="kpi-grid">
              <KPI icon="💵" value={fmt(monthExp)} label="Gasto Mensal" sub={months[now.getMonth()]+'/'+now.getFullYear()} color="#0ea5e9"/>
              <KPI icon="📈" value={fmt(expenses.filter(e=>new Date((e.expense_date||'')+'T00:00:00').getFullYear()===now.getFullYear()).reduce((s,e)=>s+(parseFloat(e.value)||0),0))} label="Gasto Anual" sub="Acumulado do ano" color="#6366f1"/>
              <KPI icon="🔧" value={fmt(expenses.length ? expenses.reduce((s,e)=>s+(parseFloat(e.value)||0),0)/expenses.length : 0)} label="Custo Médio" sub="Por despesa" color="#10b981"/>
              <KPI icon="📦" value={expenses.length} label="Total de Despesas" sub="Registradas" color="#f59e0b"/>
            </div>
            <Card title="💳 Histórico de Despesas">
              <div className="table-wrap">
                <table><thead><tr><th>Data</th><th>Equipamento</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th>Ações</th></tr></thead><tbody>
                  {expenses.map(e=>(
                    <tr key={e.id}>
                      <td className="muted">{fmtDate(e.expense_date)}</td>
                      <td>{eqMap[e.equip_id]||'—'}</td>
                      <td><span className="badge badge-blue">{e.category}</span></td>
                      <td className="muted">{e.description}</td>
                      <td style={{color:'#f59e0b',fontWeight:'700'}}>{fmt(e.value)}</td>
                      <td><button className="btn btn-danger btn-sm" onClick={()=>deleteExpense(e.id)}>🗑</button></td>
                    </tr>
                  ))}
                  {!expenses.length && <tr><td colSpan="6" style={{textAlign:'center',padding:'32px',color:'#64748b'}}>Nenhuma despesa registrada.</td></tr>}
                </tbody></table>
              </div>
            </Card>
          </div>
        )}

        {/* ══ USUÁRIOS ══ */}
        {page==='users' && (
          <div>
            <div className="search-bar">
              <input className="search-input" placeholder="🔍 Buscar usuário..." value={search} onChange={e=>setSearch(e.target.value)}/>
              <button className="btn btn-primary" onClick={()=>{setForm({inv_role:'Operador'});setModal('invite')}}>✉️ Convidar Usuário</button>
            </div>
            <div className="card" style={{padding:0}}>
              <div className="table-wrap">
                <table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Unidade</th><th>Status</th><th>Ações</th></tr></thead><tbody>
                  {profiles.filter(p=>(p.name+p.role+p.unit).toLowerCase().includes(search.toLowerCase())).map(p=>(
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong></td>
                      <td className="muted">{p.id===user?.id ? user.email : '—'}</td>
                      <td><span className={`badge badge-${p.role==='Administrador'?'danger':p.role==='Técnico'?'warning':'blue'}`}>{p.role}</span></td>
                      <td className="muted">{p.unit||'—'}</td>
                      <td><span className={`badge badge-${p.status==='Ativo'?'success':'danger'}`}>{p.status}</span></td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={()=>{setForm({id:p.id,name:p.name,role:p.role,unit:p.unit,status:p.status});setModal('editProfile')}}>✏️</button>
                        {p.id !== RAFAEL_ID && <button className="btn btn-danger btn-sm" style={{marginLeft:'4px'}} onClick={()=>deleteUser(p.id, p.name)}>🗑</button>}
                      </td>
                    </tr>
                  ))}
                  {!profiles.length && <tr><td colSpan="6" style={{textAlign:'center',padding:'32px',color:'#64748b'}}>Nenhum usuário cadastrado.</td></tr>}
                </tbody></table>
              </div>
            </div>
            <div className="card" style={{background:'rgba(99,102,241,.05)',border:'1px solid rgba(99,102,241,.2)'}}>
              <div style={{fontSize:'14px',fontWeight:'700',color:'#4f46e5',marginBottom:'8px'}}>🔗 Como funciona o convite individual</div>
              <p style={{fontSize:'13px',color:'#475569',margin:0,lineHeight:'1.6'}}>
                Ao clicar em <strong style={{color:'#1e293b'}}>✉️ Convidar Usuário</strong>, o sistema envia automaticamente um e-mail com um link único e exclusivo para aquele usuário.
                Ao clicar no link, ele define a própria senha e acessa o sistema com seu perfil personalizado.
                Cada link é de uso único e expira em 24 horas por segurança.
              </p>
            </div>
          </div>
        )}

        {/* ══ AUDITORIA ══ */}
        {page==='audit' && (
          <Card title="📋 Registro de Auditoria" sub="Todas as ações realizadas no sistema">
            <div className="table-wrap">
              <table><thead><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Módulo</th><th>Detalhes</th></tr></thead><tbody>
                {auditLog.map(a=>(
                  <tr key={a.id}>
                    <td className="muted">{a.created_at ? new Date(a.created_at).toLocaleString('pt-BR') : '—'}</td>
                    <td>{a.user_name}</td>
                    <td><span className="badge badge-blue">{a.action}</span></td>
                    <td className="muted">{a.module}</td>
                    <td className="muted">{a.detail}</td>
                  </tr>
                ))}
                {!auditLog.length && <tr><td colSpan="5" style={{textAlign:'center',padding:'32px',color:'#64748b'}}>Nenhum registro de auditoria.</td></tr>}
              </tbody></table>
            </div>
          </Card>
        )}

      </main>

      {/* ══ MODALS ══ */}
      {modal && (
        <div className="modal-overlay" onClick={e=>{if(e.target.className==='modal-overlay')setModal(null)}}>
          <div className="modal">

            {/* Equipamento */}
            {(modal==='equip') && <>
              <h2>{form.id ? '✏️ Editar Equipamento' : '➕ Adicionar Equipamento'}</h2>
              <div className="form-row">
                <FG label="Marca"><input className="fi" value={form.brand||''} onChange={e=>setForm(f=>({...f,brand:e.target.value}))} placeholder="Ex: Quanta"/></FG>
                <FG label="Modelo"><input className="fi" value={form.model||''} onChange={e=>setForm(f=>({...f,model:e.target.value}))} placeholder="Ex: Q-Plus Evo"/></FG>
              </div>
              <div className="form-row">
                <FG label="Nº de Série"><input className="fi" value={form.serial||''} onChange={e=>setForm(f=>({...f,serial:e.target.value}))} placeholder="Ex: QNT-001-2024"/></FG>
                <FG label="Tipo"><select className="fi" value={form.type||'Laser'} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                  {['Laser','Ultrassom','Estética','Diagnóstico','Outro'].map(t=><option key={t}>{t}</option>)}
                </select></FG>
              </div>
              <div className="form-row">
                <FG label="Localização"><input className="fi" value={form.location||''} onChange={e=>setForm(f=>({...f,location:e.target.value}))} placeholder="Ex: Clínica Centro"/></FG>
                <FG label="Disponibilidade"><select className="fi" value={form.availability||'Estoque'} onChange={e=>setForm(f=>({...f,availability:e.target.value}))}>
                  {['Estoque','Em Uso','Emprestado','Em Reparo'].map(a=><option key={a}>{a}</option>)}
                </select></FG>
              </div>
              <div className="form-row">
                <FG label="Status"><select className="fi" value={form.status||'Operando'} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  {['Operando','Manutenção','Inativo','Estoque'].map(s=><option key={s}>{s}</option>)}
                </select></FG>
                <FG label="Data de Aquisição"><input className="fi" type="date" value={form.acquisition_date||''} onChange={e=>setForm(f=>({...f,acquisition_date:e.target.value}))}/></FG>
              </div>
              <FG label="Observações"><textarea className="fi" rows="3" value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Informações adicionais..."/></FG>
              <ModalActions onCancel={()=>setModal(null)} onSave={saveEquipment}/>
            </>}

            {/* Ordem de Serviço */}
            {modal==='order' && <>
              <h2>{form.id ? '✏️ Editar OS' : '🔧 Nova Ordem de Serviço'}</h2>
              <div className="form-row">
                <FG label="Equipamento"><select className="fi" value={form.equip_id||''} onChange={e=>setForm(f=>({...f,equip_id:e.target.value}))}>
                  {equipment.map(e=><option key={e.id} value={e.id}>{e.brand} {e.model} ({e.serial})</option>)}
                </select></FG>
                <FG label="Tipo"><select className="fi" value={form.type||'Preventiva'} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                  {['Preventiva','Corretiva','Calibração','Revisão Geral'].map(t=><option key={t}>{t}</option>)}
                </select></FG>
              </div>
              <div className="form-row">
                <FG label="Técnico Responsável"><input className="fi" value={form.tech||''} onChange={e=>setForm(f=>({...f,tech:e.target.value}))} placeholder="Nome do técnico"/></FG>
                <FG label="Data Abertura"><input className="fi" type="date" value={form.open_date||''} onChange={e=>setForm(f=>({...f,open_date:e.target.value}))}/></FG>
              </div>
              <div className="form-row">
                <FG label="Custo (R$)"><input className="fi" type="number" step="0.01" value={form.cost||''} onChange={e=>setForm(f=>({...f,cost:e.target.value}))} placeholder="0.00"/></FG>
                <FG label="Status"><select className="fi" value={form.status||'Aberta'} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  {['Aberta','Em Andamento','Concluída','Cancelada'].map(s=><option key={s}>{s}</option>)}
                </select></FG>
              </div>
              <FG label="Descrição / Problema"><textarea className="fi" rows="3" value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Descreva o problema..."/></FG>
              <ModalActions onCancel={()=>setModal(null)} onSave={saveOrder}/>
            </>}

            {/* Parada */}
            {modal==='stop' && <>
              <h2>⏸ Agendar Parada</h2>
              <FG label="Equipamento"><select className="fi" value={form.equip_id||''} onChange={e=>setForm(f=>({...f,equip_id:e.target.value}))}>
                {equipment.map(e=><option key={e.id} value={e.id}>{e.brand} {e.model}</option>)}
              </select></FG>
              <div className="form-row">
                <FG label="Data Início"><input className="fi" type="date" value={form.start_date||''} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))}/></FG>
                <FG label="Data Fim"><input className="fi" type="date" value={form.end_date||''} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))}/></FG>
              </div>
              <FG label="Motivo"><textarea className="fi" rows="3" value={form.reason||''} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} placeholder="Motivo da parada..."/></FG>
              <ModalActions onCancel={()=>setModal(null)} onSave={saveStop}/>
            </>}

            {/* Logística */}
            {modal==='logistic' && <>
              <h2>📅 Novo Evento de Logística</h2>
              <div className="form-row">
                <FG label="Data"><input className="fi" type="date" value={form.event_date||''} onChange={e=>setForm(f=>({...f,event_date:e.target.value}))}/></FG>
                <FG label="Tipo"><select className="fi" value={form.log_type||'Entrega'} onChange={e=>setForm(f=>({...f,log_type:e.target.value}))}>
                  {['Entrega','Retirada','Manutenção','Instalação','Treinamento'].map(t=><option key={t}>{t}</option>)}
                </select></FG>
              </div>
              <FG label="Equipamento"><select className="fi" value={form.equip_id||''} onChange={e=>setForm(f=>({...f,equip_id:e.target.value}))}>
                <option value="">— Nenhum —</option>
                {equipment.map(e=><option key={e.id} value={e.id}>{e.brand} {e.model}</option>)}
              </select></FG>
              <FG label="Descrição"><textarea className="fi" rows="3" value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Detalhes do evento..."/></FG>
              <ModalActions onCancel={()=>setModal(null)} onSave={saveLogistic}/>
            </>}

            {/* Fornecedor */}
            {modal==='vendor' && <>
              <h2>{form.id ? '✏️ Editar Fornecedor' : '🏭 Novo Fornecedor'}</h2>
              <div className="form-row">
                <FG label="Empresa"><input className="fi" value={form.company||''} onChange={e=>setForm(f=>({...f,company:e.target.value}))} placeholder="Razão social"/></FG>
                <FG label="Contato"><input className="fi" value={form.contact||''} onChange={e=>setForm(f=>({...f,contact:e.target.value}))} placeholder="Nome do contato"/></FG>
              </div>
              <div className="form-row">
                <FG label="Telefone"><input className="fi" value={form.phone||''} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="(00) 00000-0000"/></FG>
                <FG label="E-mail"><input className="fi" type="email" value={form.email||''} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="contato@empresa.com"/></FG>
              </div>
              <div className="form-row">
                <FG label="Especialidade"><input className="fi" value={form.specialty||''} onChange={e=>setForm(f=>({...f,specialty:e.target.value}))} placeholder="Ex: Manutenção Laser"/></FG>
                <FG label="Avaliação"><select className="fi" value={form.rating||'5 ⭐'} onChange={e=>setForm(f=>({...f,rating:e.target.value}))}>
                  {['5 ⭐','4 ⭐','3 ⭐','2 ⭐','1 ⭐'].map(r=><option key={r}>{r}</option>)}
                </select></FG>
              </div>
              <FG label="Observações"><textarea className="fi" rows="2" value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></FG>
              <ModalActions onCancel={()=>setModal(null)} onSave={saveVendor}/>
            </>}

            {/* Despesa */}
            {modal==='expense' && <>
              <h2>💰 Nova Despesa</h2>
              <div className="form-row">
                <FG label="Data"><input className="fi" type="date" value={form.expense_date||''} onChange={e=>setForm(f=>({...f,expense_date:e.target.value}))}/></FG>
                <FG label="Equipamento"><select className="fi" value={form.equip_id||''} onChange={e=>setForm(f=>({...f,equip_id:e.target.value}))}>
                  <option value="">— Nenhum —</option>
                  {equipment.map(e=><option key={e.id} value={e.id}>{e.brand} {e.model}</option>)}
                </select></FG>
              </div>
              <div className="form-row">
                <FG label="Categoria"><select className="fi" value={form.category||'Manutenção'} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                  {['Manutenção','Peças/Acessórios','Calibração','Transporte','Outros'].map(c=><option key={c}>{c}</option>)}
                </select></FG>
                <FG label="Valor (R$)"><input className="fi" type="number" step="0.01" value={form.value||''} onChange={e=>setForm(f=>({...f,value:e.target.value}))} placeholder="0.00"/></FG>
              </div>
              <FG label="Descrição"><textarea className="fi" rows="2" value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/></FG>
              <ModalActions onCancel={()=>setModal(null)} onSave={saveExpense}/>
            </>}

            {/* Convidar Usuário */}
            {modal==='invite' && <>
              <h2>✉️ Convidar Usuário</h2>
              <p style={{fontSize:'13px',color:'#94a3b8',marginBottom:'20px',lineHeight:'1.6'}}>
                O usuário receberá um <strong style={{color:'#a5b4fc'}}>link único por e-mail</strong> para definir a senha e acessar o sistema com o perfil configurado abaixo.
              </p>
              <div className="form-row">
                <FG label="Nome Completo"><input className="fi" value={form.inv_name||''} onChange={e=>setForm(f=>({...f,inv_name:e.target.value}))} placeholder="Nome do usuário"/></FG>
                <FG label="E-mail"><input className="fi" type="email" value={form.inv_email||''} onChange={e=>setForm(f=>({...f,inv_email:e.target.value}))} placeholder="email@dominio.com"/></FG>
              </div>
              <div className="form-row">
                <FG label="Perfil"><select className="fi" value={form.inv_role||'Operador'} onChange={e=>setForm(f=>({...f,inv_role:e.target.value}))}>
                  {['Administrador','Técnico','Operador','Visualizador'].map(r=><option key={r}>{r}</option>)}
                </select></FG>
                <FG label="Unidade"><input className="fi" value={form.inv_unit||''} onChange={e=>setForm(f=>({...f,inv_unit:e.target.value}))} placeholder="Ex: Filial Centro"/></FG>
              </div>
              <ModalActions onCancel={()=>setModal(null)} onSave={inviteUserAction} saveLabel="✉️ Enviar Convite"/>
            </>}

            {/* Editar Perfil */}
            {modal==='editProfile' && <>
              <h2>✏️ Editar Perfil</h2>
              <div className="form-row">
                <FG label="Nome"><input className="fi" value={form.name||''} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></FG>
                <FG label="Perfil"><select className="fi" value={form.role||'Operador'} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                  {['Administrador','Técnico','Operador','Visualizador'].map(r=><option key={r}>{r}</option>)}
                </select></FG>
              </div>
              <div className="form-row">
                <FG label="Unidade"><input className="fi" value={form.unit||''} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}/></FG>
                <FG label="Status"><select className="fi" value={form.status||'Ativo'} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  {['Ativo','Inativo'].map(s=><option key={s}>{s}</option>)}
                </select></FG>
              </div>
              <ModalActions onCancel={()=>setModal(null)} onSave={async()=>{
                await db.profiles.update(form.id,{name:form.name,role:form.role,unit:form.unit,status:form.status})
                setModal(null); reload(); showToast('Perfil atualizado!')
              }}/>
            </>}

          </div>
        </div>
      )}

      {/* TOAST */}
      <div style={{position:'fixed',bottom:'24px',right:'24px',zIndex:999,background:toast.err?'#ef4444':'#10b981',color:'#fff',
        padding:'12px 20px',borderRadius:'10px',fontSize:'13px',fontWeight:'600',
        transform:toast.show?'translateY(0)':'translateY(80px)',opacity:toast.show?1:0,
        transition:'all .3s',boxShadow:'0 4px 24px rgba(0,0,0,.4)'}}>
        {toast.msg}
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────
function KPI({ icon, value, label, sub, color }) {
  return (
    <div style={{background:'#ffffff',border:'1px solid #e2e8f0',borderRadius:'12px',padding:'20px',position:'relative',overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,.06)'}}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:'3px',background:color}}/>
      <div style={{width:'44px',height:'44px',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',marginBottom:'12px',background:color+'18'}}>{icon}</div>
      <div style={{fontSize:'28px',fontWeight:'800',lineHeight:'1',color:'#1e293b'}}>{value}</div>
      <div style={{fontSize:'13px',fontWeight:'600',color:'#475569',marginTop:'4px'}}>{label}</div>
      <div style={{fontSize:'11px',color:'#94a3b8',marginTop:'2px'}}>{sub}</div>
    </div>
  )
}

function Card({ title, sub, children, action }) {
  return (
    <div className="card">
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'16px'}}>
        <div>
          <div style={{fontSize:'15px',fontWeight:'700'}}>{title}</div>
          {sub && <div style={{fontSize:'12px',color:'#94a3b8',marginTop:'2px'}}>{sub}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Badge({ status }) {
  const color = {Operando:'#10b981',Manutenção:'#f59e0b',Inativo:'#ef4444',Estoque:'#8b5cf6',
    Concluída:'#10b981',Aberta:'#6366f1','Em Andamento':'#f59e0b',Cancelada:'#ef4444',
    Ativo:'#10b981'}[status]||'#64748b'
  return <span style={{display:'inline-flex',alignItems:'center',padding:'3px 10px',borderRadius:'999px',fontSize:'11px',fontWeight:'700',background:color+'22',color}}>{status}</span>
}

function FG({ label, children }) {
  return <div style={{marginBottom:'14px'}}><label style={{display:'block',fontSize:'12px',fontWeight:'600',color:'#94a3b8',marginBottom:'6px'}}>{label}</label>{children}</div>
}

function ModalActions({ onCancel, onSave, saveLabel='💾 Salvar' }) {
  return (
    <div style={{display:'flex',gap:'10px',justifyContent:'flex-end',marginTop:'20px'}}>
      <button className="btn btn-outline" onClick={onCancel}>Cancelar</button>
      <button className="btn btn-primary" onClick={onSave}>{saveLabel}</button>
    </div>
  )
}

function Empty({ icon, msg }) {
  return <div style={{textAlign:'center',padding:'32px 20px',color:'#94a3b8'}}><div style={{fontSize:'36px',marginBottom:'8px'}}>{icon}</div><p style={{fontSize:'13px',margin:0}}>{msg}</p></div>
}

// ── CSS v3 (white main, dark sidebar) ────────────────────────
const CSS = `
  html,body{background:#ffffff !important}
  *{box-sizing:border-box}
  ::-webkit-scrollbar{width:6px;height:6px}
  ::-webkit-scrollbar-track{background:#f8fafc}
  ::-webkit-scrollbar-thumb{background:#94a3b8;border-radius:3px}
  /* ── SIDEBAR (dark) ── */
  .sidebar{position:fixed;left:0;top:0;bottom:0;width:260px;background:#1e293b;border-right:1px solid #334155;display:flex;flex-direction:column;z-index:100;transition:transform .3s}
  .sidebar.collapsed{transform:translateX(-260px)}
  .sidebar-header{padding:20px 20px 16px;border-bottom:1px solid #334155;display:flex;align-items:center;gap:12px}
  .sidebar-title{font-size:17px;font-weight:800;color:#a5b4fc;line-height:1.1}
  .sidebar-sub{font-size:10px;color:#475569}
  .nav-section{padding:16px 12px 0}
  .nav-label{font-size:10px;font-weight:700;letter-spacing:1.2px;color:#475569;text-transform:uppercase;padding:0 8px;margin-bottom:8px}
  .nav-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;transition:all .2s;color:#94a3b8;font-size:14px;font-weight:500;margin-bottom:2px;border:none;background:none;width:100%;text-align:left}
  .nav-item:hover{background:#334155;color:#f1f5f9}
  .nav-item.active{background:linear-gradient(135deg,rgba(99,102,241,.25),rgba(14,165,233,.15));color:#a5b4fc;border:1px solid rgba(99,102,241,.3)}
  .nav-icon{font-size:16px;width:20px;text-align:center}
  .nav-badge{margin-left:auto;background:#ef4444;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:999px}
  .sidebar-footer{margin-top:auto;padding:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:10px}
  .user-avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#0ea5e9);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;flex-shrink:0}
  .logout-btn{margin-left:auto;background:none;border:1px solid #334155;border-radius:8px;padding:5px 8px;cursor:pointer;color:#94a3b8;font-size:11px;transition:all .2s}
  .logout-btn:hover{background:#ef4444;color:#fff;border-color:#ef4444}
  /* ── HEADER (light) ── */
  .app-header{position:fixed;top:0;left:260px;right:0;height:64px;background:#ffffff !important;border-bottom:2px solid #e2e8f0;display:flex;align-items:center;padding:0 24px;gap:16px;z-index:90;transition:left .3s;color:#1e293b !important}
  .app-header.full{left:0}
  .toggle-btn{background:none;border:1px solid #e2e8f0;border-radius:8px;padding:6px 10px;cursor:pointer;color:#64748b;font-size:16px;transition:all .2s;flex-shrink:0}
  .toggle-btn:hover{background:#f1f5f9;color:#1e293b}
  .header-search{margin-left:auto;display:flex;align-items:center;gap:8px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 14px}
  .notif-btn{background:none;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;cursor:pointer;color:#64748b;font-size:16px;position:relative;transition:all .2s}
  .notif-btn:hover{background:#f1f5f9}
  .notif-dot{position:absolute;top:4px;right:4px;width:8px;height:8px;background:#ef4444;border-radius:50%;border:2px solid #fff}
  /* ── MAIN AREA (white) ── */
  .app-main{margin-left:260px;margin-top:64px;padding:28px;transition:margin-left .3s;min-height:calc(100vh - 64px);background:#ffffff !important;color:#1e293b !important}
  .app-main *{color:#1e293b}
  .app-main.full{margin-left:0}
  .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}
  .card{background:#ffffff !important;border:1px solid #e2e8f0 !important;border-radius:12px;padding:20px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,.06)}
  .search-bar{display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap}
  .search-input{padding:9px 14px;border-radius:9px;background:#fff;border:1px solid #e2e8f0;color:#1e293b;font-size:13px;outline:none;flex:1;min-width:160px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
  .search-input:focus{border-color:#6366f1}
  .btn{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:9px;border:none;cursor:pointer;font-size:13px;font-weight:600;transition:all .2s;text-decoration:none}
  .btn-primary{background:#6366f1;color:#fff}
  .btn-primary:hover{background:#4f46e5}
  .btn-warning{background:#f59e0b;color:#fff}
  .btn-danger{background:#ef4444;color:#fff}
  .btn-outline{background:transparent;border:1px solid #e2e8f0;color:#64748b}
  .btn-outline:hover{background:#f1f5f9;color:#1e293b}
  .btn-sm{padding:5px 10px;font-size:12px}
  .table-wrap{overflow-x:auto;border-radius:10px}
  table{width:100%;border-collapse:collapse}
  thead th{padding:12px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#64748b;background:#ffffff;border-bottom:2px solid #e2e8f0}
  tbody tr{border-bottom:1px solid #f1f5f9;transition:background .15s;color:#1e293b}
  tbody tr:hover{background:#f0f9ff}
  tbody td{padding:13px 16px;font-size:13px}
  td.muted{color:#64748b}
  .badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700}
  .badge-success{background:rgba(16,185,129,.12);color:#059669}
  .badge-warning{background:rgba(245,158,11,.12);color:#d97706}
  .badge-danger{background:rgba(239,68,68,.12);color:#dc2626}
  .badge-blue{background:rgba(14,165,233,.12);color:#0284c7}
  .badge-info{background:rgba(139,92,246,.12);color:#7c3aed}
  .badge-gray{background:rgba(100,116,139,.12);color:#475569}
  .tabs{display:flex;gap:4px;margin-bottom:20px;background:#f1f5f9;padding:4px;border-radius:10px;width:fit-content;border:1px solid #e2e8f0}
  .tab-btn{padding:8px 18px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:600;color:#64748b;background:transparent;transition:all .2s}
  .tab-btn.active{background:#fff;color:#1e293b;box-shadow:0 2px 8px rgba(0,0,0,.1)}
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px}
  .modal{background:#1e293b;border:1px solid #334155;border-radius:16px;padding:28px;width:100%;max-width:580px;max-height:90vh;overflow-y:auto;box-shadow:0 25px 50px rgba(0,0,0,.6)}
  .modal h2{font-size:18px;font-weight:700;margin-bottom:20px;color:#a5b4fc}
  .form-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .fi{width:100%;padding:9px 12px;border-radius:8px;background:#334155;border:1.5px solid #334155;color:#f1f5f9;font-size:13px;outline:none;transition:border-color .2s;font-family:inherit;resize:vertical}
  .fi:focus{border-color:#6366f1}
  .fi option{background:#1e293b}
  @media(max-width:768px){.kpi-grid{grid-template-columns:repeat(2,1fr)}.grid2{grid-template-columns:1fr}.form-row{grid-template-columns:1fr}.sidebar{transform:translateX(-260px)}.sidebar.open{transform:translateX(0)}.app-header{left:0}.app-main{margin-left:0}}
`
