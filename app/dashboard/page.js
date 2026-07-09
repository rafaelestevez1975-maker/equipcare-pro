'use client'
export const dynamic = 'force-dynamic';
import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getClient, signOut, db } from '@/lib/supabase'

// ─── helpers ───────────────────────────────────────────────
const fmt = (v) => 'R$ ' + (parseFloat(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:2})
const fmtDate = (d) => { if(!d) return '—'; const dt=new Date(d+'T00:00:00'); return dt.toLocaleDateString('pt-BR') }
const uid = () => crypto.randomUUID()
const today = () => new Date().toISOString().split('T')[0]
const statusColor = (s) => ({
  'Operando 100%':'#10b981','Operando Parcial':'#84cc16',Operando:'#10b981',
  'Manutenção':'#f59e0b','Inativo':'#ef4444','Estoque':'#8b5cf6',
  'Concluída':'#10b981','Aberta':'#6366f1','Em Andamento':'#f59e0b','Cancelada':'#ef4444'
}[s]||'#64748b')
const badgeCls = (s) => ({
  'Operando 100%':'success','Operando Parcial':'success',Operando:'success',
  'Manutenção':'warning','Inativo':'danger','Estoque':'info',
  'Concluída':'success','Aberta':'blue','Em Andamento':'warning','Cancelada':'danger',
  'Ativo':'success','Administrador':'danger','Técnico':'warning','Operador':'blue','Visualizador':'gray'
}[s]||'gray')

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
  const [units, setUnits]         = useState([])
  const [statuses, setStatuses]   = useState([])
  const [eqTypes, setEqTypes]     = useState([])

  // Modal/form state
  const [modal, setModal] = useState(null)
  const [form, setForm]   = useState({})
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({})
  const [maintTab, setMaintTab] = useState('prev')
  const [adminTab, setAdminTab] = useState('users')
  const [calYear, setCalYear]   = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [inviteLink, setInviteLink] = useState('')

  // Tips state
  const [tips, setTips]             = useState([])
  const [tipMovements, setTipMovements] = useState([])
  const [tipPurchases, setTipPurchases] = useState([])
  const [tipAudits, setTipAudits]   = useState([])
  const [tipsTab, setTipsTab]       = useState('resumo')

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
    const [eq, or, st, lo, ve, ex, au, pr, un, ss, et, tp, tm, tpu, ta] = await Promise.all([
      db.equipment.getAll(), db.orders.getAll(), db.stops.getAll(),
      db.logistics.getAll(), db.vendors.getAll(), db.expenses.getAll(),
      db.audit.getAll(), db.profiles.getAll(),
      db.units.getAll(), db.statuses.getAll(), db.equipment_types.getAll(),
      db.tips.getAll(), db.tip_movements.getAll(), db.tip_purchases.getAll(), db.tip_audits.getAll()
    ])
    setEquipment(eq.data || [])
    setOrders(or.data || [])
    setStops(st.data || [])
    setLogistics(lo.data || [])
    setVendors(ve.data || [])
    setExpenses(ex.data || [])
    setAuditLog(au.data || [])
    setProfiles(pr.data || [])
    setUnits(un.data || [])
    setStatuses(ss.data || [])
    setEqTypes(et.data || [])
    setTips(tp.data || [])
    setTipMovements(tm.data || [])
    setTipPurchases(tpu.data || [])
    setTipAudits(ta.data || [])
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
      unit: form.unit || null, location: form.location, availability: form.availability,
      status: form.status, acquisition_date: form.acquisition_date || null,
      notes: form.notes, created_by: user.id
    }
    if (!data.brand || !data.model) { showToast('Preencha marca e modelo.',true); return }
    if (!data.serial) { showToast('Informe o número de série.',true); return }
    let error
    if (form.id) {
      const res = await db.equipment.update(form.id, data); error = res.error
      if (!error) { await addAudit('Editou','Inventário',`${data.brand} ${data.model}`); showToast('Equipamento atualizado!') }
    } else {
      const res = await db.equipment.insert(data); error = res.error
      if (!error) { await addAudit('Adicionou','Inventário',`${data.brand} ${data.model}`); showToast('Equipamento adicionado!') }
    }
    if (error) { showToast('Erro ao salvar: ' + error.message, true); return }
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
      equip_id: form.equip_id || null, type: form.type || 'Preventiva', tech: form.tech,
      open_date: form.open_date || today(), cost: parseFloat(form.cost)||0,
      status: form.status || 'Aberta', description: form.description || '', created_by: user.id
    }
    if (!data.equip_id) { showToast('Selecione o equipamento.',true); return }
    if (!data.tech) { showToast('Informe o técnico responsável.',true); return }
    let error
    if (form.id) {
      const res = await db.orders.update(form.id, data); error = res.error
      if (!error) showToast('OS atualizada!')
    } else {
      const res = await db.orders.insert(data); error = res.error
      if (!error) { await addAudit('Criou OS','Manutenções',data.type); showToast('OS criada!') }
    }
    if (error) { showToast('Erro ao salvar OS: ' + error.message, true); return }
    setModal(null); reload()
  }

  async function deleteOrder(id) {
    if (!confirm('Remover esta OS?')) return
    await db.orders.delete(id); showToast('OS removida.'); reload()
  }

  async function saveStop() {
    if (!form.start_date || !form.end_date) { showToast('Informe as datas de início e fim.',true); return }
    const { error } = await db.stops.insert({ equip_id: form.equip_id||null, start_date: form.start_date, end_date: form.end_date, reason: form.reason||'' })
    if (error) { showToast('Erro ao agendar: ' + error.message, true); return }
    await addAudit('Agendou Parada','Manutenções',`${form.start_date} → ${form.end_date}`)
    setModal(null); showToast('Parada agendada!'); reload()
  }

  async function saveLogistic() {
    const data = {
      event_date: form.event_date, log_type: form.log_type,
      equip_id: form.equip_id||null, description: form.description||'',
      store: form.store||'', serial: form.serial||''
    }
    let error
    if (form.id) {
      const res = await db.logistics.update(form.id, data); error = res.error
      if (!error) showToast('Evento atualizado!')
    } else {
      const res = await db.logistics.insert(data); error = res.error
      if (!error) { await addAudit('Adicionou Evento','Logística',form.log_type); showToast('Evento adicionado!') }
    }
    if (error) { showToast('Erro: ' + error.message, true); return }
    setModal(null); reload()
  }

  async function saveVendor() {
    const data = {
      company: form.company, name: form.company,
      contact: form.contact, contact_name: form.contact,
      phone: form.phone, email: form.email,
      specialty: form.specialty, service_type: form.specialty,
      rating: form.rating||'5 ⭐', notes: form.notes||''
    }
    if (!data.company) { showToast('Informe o nome da empresa.',true); return }
    let error
    if (form.id) {
      const res = await db.vendors.update(form.id, data); error = res.error
      if (!error) showToast('Fornecedor atualizado!')
    } else {
      const res = await db.vendors.insert(data); error = res.error
      if (!error) { await addAudit('Adicionou','Fornecedores',data.company); showToast('Fornecedor adicionado!') }
    }
    if (error) { showToast('Erro ao salvar: ' + error.message, true); return }
    setModal(null); reload()
  }

  async function deleteVendor(id, name) {
    if (!confirm(`Remover ${name}?`)) return
    await db.vendors.delete(id); showToast('Fornecedor removido.'); reload()
  }

  async function saveExpense() {
    if (!form.value) { showToast('Informe o valor.',true); return }
    const { error } = await db.expenses.insert({ expense_date: form.expense_date || today(), equip_id: form.equip_id||null, category: form.category, value: parseFloat(form.value), description: form.description })
    if (error) { showToast('Erro ao registrar despesa: ' + error.message, true); return }
    await addAudit('Registrou Despesa','Financeiro', fmt(form.value))
    setModal(null); showToast('Despesa registrada!'); reload()
  }

  async function deleteExpense(id) {
    await db.expenses.delete(id); showToast('Despesa removida.'); reload()
  }

  // ── Tips CRUD ──────────────────────────────────────────────
  const TIP_TYPES = ['1.5 DOT','2.0 DOT','3.0 DOT','3.0 LINEAR','4.5 DOT','6.0 LINEAR','9.0 LINEAR','13.0 LINEAR']
  const TIP_MAX_SHOTS = {'1.5 DOT':10000,'2.0 DOT':10000,'3.0 DOT':10000,'3.0 LINEAR':20000,'4.5 DOT':10000,'6.0 LINEAR':20000,'9.0 LINEAR':20000,'13.0 LINEAR':20000}
  const TIP_PRICE = {'1.5 DOT':5000,'2.0 DOT':5000,'3.0 DOT':5000,'4.5 DOT':5000,'3.0 LINEAR':9000,'6.0 LINEAR':9000,'9.0 LINEAR':9000,'13.0 LINEAR':9000}
  const LOJAS_TIP = ['Butantã','Campo Limpo','Frei Caneca','Loja Conceito','Metro Tatuapé','Metro Tucuruvi','West Plaza','Moema','Osasco','Treinamento','Estoque']
  // Colunas de ponteiras na visão matriz (igual à planilha)
  const TIP_COLS = [
    {key:'13l', label:'13,0mm\nLinear', type:'13.0 LINEAR'},
    {key:'9l',  label:'9,0mm\nLinear',  type:'9.0 LINEAR'},
    {key:'6l',  label:'6,0mm\nLinear',  type:'6.0 LINEAR'},
    {key:'45d', label:'4,5mm\nDOT',     type:'4.5 DOT'},
    {key:'3d',  label:'3,0mm\nDOT',     type:'3.0 DOT'},
    {key:'2d',  label:'2,0mm\nDOT',     type:'2.0 DOT'},
  ]
  // Equipamentos Quanta UC por cor
  const UC_EQUIP = [
    {serial:'UQIA24044', label:'UC Verde',    color:'#22c55e'},
    {serial:'UQIA24043', label:'UC Amarela',  color:'#eab308'},
    {serial:'UQIA24046', label:'UC Vermelha', color:'#ef4444'},
  ]

  function tipAlertPct(tip) { return tip.total_shots > 0 ? tip.current_shots / tip.total_shots : 1 }

  async function saveTip() {
    const data = {
      serial: form.serial, tip_type: form.tip_type,
      equipment_id: form.equipment_id || null,
      total_shots: parseInt(form.total_shots) || TIP_MAX_SHOTS[form.tip_type] || 10000,
      current_shots: parseInt(form.current_shots) || parseInt(form.total_shots) || TIP_MAX_SHOTS[form.tip_type] || 10000,
      status: form.status || 'Ativa',
      current_unit: form.current_unit || '',
      purchase_order: form.purchase_order || '',
      purchase_date: form.purchase_date || null,
      price: parseFloat(form.price) || TIP_PRICE[form.tip_type] || 5000,
      notes: form.notes || ''
    }
    if (!data.serial) { showToast('Informe o número de série.',true); return }
    if (!data.tip_type) { showToast('Selecione o tipo de ponteira.',true); return }
    let error
    if (form.id) {
      const res = await db.tips.update(form.id, data); error = res.error
      if (!error) showToast('Ponteira atualizada!')
    } else {
      const res = await db.tips.insert(data); error = res.error
      if (!error) { await addAudit('Cadastrou Ponteira','Ponteiras',`${data.tip_type} · ${data.serial}`); showToast('Ponteira cadastrada!') }
    }
    if (error) { showToast('Erro: ' + error.message, true); return }
    setModal(null); reload()
  }

  async function deleteTip(id) {
    if (!confirm('Remover esta ponteira?')) return
    await db.tips.delete(id); showToast('Ponteira removida.'); reload()
  }

  async function saveTipMovement() {
    if (!form.unit) { showToast('Informe a unidade.',true); return }
    if (!form.movement_date) { showToast('Informe a data de entrada.',true); return }
    const n = (v) => (v !== '' && v !== undefined && v !== null) ? parseInt(v) : null
    const data = {
      equipment_id: form.equipment_id || null,
      movement_date: form.movement_date, date_out: form.date_out || null,
      unit: form.unit, movement_type: 'Visita',
      shots_in: 0, shots_out: 0, shots_balance: 0,
      shots_13l_in:  n(form.shots_13l_in),  shots_13l_out:  n(form.shots_13l_out),
      shots_9l_in:   n(form.shots_9l_in),   shots_9l_out:   n(form.shots_9l_out),
      shots_6l_in:   n(form.shots_6l_in),   shots_6l_out:   n(form.shots_6l_out),
      shots_45d_in:  n(form.shots_45d_in),  shots_45d_out:  n(form.shots_45d_out),
      shots_3d_in:   n(form.shots_3d_in),   shots_3d_out:   n(form.shots_3d_out),
      shots_2d_in:   n(form.shots_2d_in),   shots_2d_out:   n(form.shots_2d_out),
      notes: form.notes || '', created_by: user.id
    }
    let error
    if (form.id) {
      const res = await db.tip_movements.update(form.id, data); error = res.error
      if (!error) showToast('Visita atualizada!')
    } else {
      const res = await db.tip_movements.insert(data); error = res.error
      if (!error) await addAudit('Visita Ponteiras','Ponteiras',`${form.unit} · ${form.movement_date}`)
    }
    if (error) { showToast('Erro: ' + error.message, true); return }
    setModal(null); showToast(form.id ? 'Visita atualizada!' : 'Visita registrada!'); reload()
  }

  async function saveTipPurchase() {
    if (!form.purchase_number || !form.purchase_date) { showToast('Informe número e data da compra.',true); return }
    const data = {
      purchase_number: form.purchase_number, purchase_date: form.purchase_date,
      tip_type: form.tip_type || '', serial: form.serial || '',
      quantity: parseInt(form.quantity) || 1,
      price: parseFloat(form.price) || 0, notes: form.notes || ''
    }
    let error
    if (form.id) {
      const res = await db.tip_purchases.update(form.id, data); error = res.error
      if (!error) showToast('Compra atualizada!')
    } else {
      const res = await db.tip_purchases.insert(data); error = res.error
      if (!error) { await addAudit('Compra Ponteira','Ponteiras',data.purchase_number); showToast('Compra registrada!') }
    }
    if (error) { showToast('Erro: ' + error.message, true); return }
    setModal(null); reload()
  }

  async function saveTipAudit() {
    if (!form.unit || !form.audit_week) { showToast('Informe unidade e semana.',true); return }
    const shotsPerSess = parseInt(form.shots_per_session) || 0
    const services = parseInt(form.services_count) || 0
    const expected = shotsPerSess * services
    const actual = parseInt(form.actual_shots) || 0
    const diff = Math.abs(expected - actual)
    const pct = expected > 0 ? diff / expected : 0
    const status = pct > 0.1 ? 'Divergência' : 'Concluída'
    const data = {
      audit_week: form.audit_week, unit: form.unit, tip_id: form.tip_id || null,
      tip_type: form.tip_type || '', expected_shots: expected, actual_shots: actual,
      services_count: services, shots_per_session: shotsPerSess,
      status, notes: form.notes || '', created_by: user.id
    }
    const { error } = await db.tip_audits.insert(data)
    if (error) { showToast('Erro: ' + error.message, true); return }
    await addAudit('Auditoria Ponteira','Ponteiras',`${form.unit} · ${status}`)
    setModal(null); showToast('Auditoria registrada!'); reload()
  }

  function pickAuditUnit() {
    const week = new Date(); week.setDate(week.getDate() - week.getDay())
    const weekStr = week.toISOString().split('T')[0]
    const already = tipAudits.find(a => a.audit_week === weekStr)
    if (already) { showToast(`Auditoria desta semana já registrada: ${already.unit}`); return }
    // pick deterministically by week number so it's the same for everyone
    const wn = Math.floor(week / (7*24*3600*1000))
    const chosen = LOJAS_TIP[wn % LOJAS_TIP.length]
    setForm({ audit_week: weekStr, unit: chosen })
    setModal('auditoria')
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
  const opEquip = equipment.filter(e => e.status && e.status.startsWith('Operando')).length
  const monthExp = expenses.filter(e => {
    const d = new Date((e.expense_date||'')+'T00:00:00')
    return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear()
  }).reduce((s,e)=>s+(parseFloat(e.value)||0),0)

  const eqMap = Object.fromEntries(equipment.map(e=>[e.id, `${e.brand} ${e.model}`]))
  const eqFull = Object.fromEntries(equipment.map(e=>[e.id, e])) // mapa completo por id

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

  // Cores por nº de série conforme planilha Excel
  const SERIAL_COLORS = {
    'UQIA24043': '#eab308', // UC Amarelo
    'UQIA24046': '#ef4444', // UC Vermelho
    'UQIA24044': '#22c55e', // UC Verde
    '1572219':   '#4c1d95', // AlexOne Roxo escuro
    '1899819':   '#c2410c', // AlexOne Laranja escuro
  }
  function serialColor(serial) { return serial ? (SERIAL_COLORS[serial] || '#6366f1') : '#6366f1' }
  function calEventColor(ev) {
    if (ev && ev.serial && SERIAL_COLORS[ev.serial]) return SERIAL_COLORS[ev.serial]
    if (ev && ev.equip_id && eqFull[ev.equip_id]?.serial) return serialColor(eqFull[ev.equip_id].serial)
    const byType = {Entrega:'#10b981',Retirada:'#f59e0b',Manutenção:'#6366f1',Instalação:'#0ea5e9',Treinamento:'#8b5cf6'}
    return byType[ev?.log_type||ev] || '#6366f1'
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
            ['logistics','📅','Calendário de Logística'],['vendors','🏭','Fornecedores'],
            ['tips','💡','Gestão de Ponteiras'],['financial','💰','Relatórios Financeiros']
          ].map(([id,icon,label])=>(
            <button key={id} className={`nav-item${page===id?' active':''}`} onClick={()=>setPage(id)}>
              <span className="nav-icon">{icon}</span> {label}
              {id==='maintenance' && openOrders>0 && <span className="nav-badge">{openOrders}</span>}
            </button>
          ))}
        </div>

        <div className="nav-section"><div className="nav-label">Administração</div>
          {[['admin','⚙️','Administração'],['audit','📋','Auditoria de Ações']].map(([id,icon,label])=>(
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
            tips:'Gestão e Compra de Ponteiras',users:'Gestão de Usuários',audit:'Auditoria de Ações'}[page]}
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
              <Card title="📍 Distribuição por Unidade" sub="Equipamentos por unidade da rede">
                {(() => {
                  const units = {}
                  equipment.forEach(e => { units[e.unit||'Sem unidade'] = (units[e.unit||'Sem unidade']||0)+1 })
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
              <button className="btn btn-primary" onClick={()=>{setForm({availability:'Em Uso',status:'Operando 100%',acquisition_date:today()});setModal('equip')}}>➕ Adicionar Equipamento</button>
            </div>
            <div className="card" style={{padding:0}}>
              <div className="table-wrap">
                <table><thead><tr>
                  <th>Equipamento</th><th>Nº de Série</th><th>Tipo</th>
                  <th>Unidade</th><th>Localização</th><th>Status</th><th>Ações</th>
                </tr></thead><tbody>
                  {equipment.filter(e=>{
                    const q = search.toLowerCase()
                    const matchQ = (e.brand+e.model+e.serial+e.location+(e.unit||'')).toLowerCase().includes(q)
                    const matchS = !filters.status || e.status===filters.status
                    const matchT = !filters.type || e.type===filters.type
                    return matchQ && matchS && matchT
                  }).map(e=>(
                    <tr key={e.id}>
                      <td><strong>{e.brand} {e.model}</strong></td>
                      <td className="muted">{e.serial}</td>
                      <td><span className="badge badge-blue">{e.type||'—'}</span></td>
                      <td className="muted">{e.unit||'—'}</td>
                      <td className="muted">{e.location||'—'}</td>
                      <td><Badge status={e.status}/></td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={()=>{setForm({id:e.id,brand:e.brand,model:e.model,serial:e.serial,type:e.type,unit:e.unit,location:e.location,availability:e.availability,status:e.status,acquisition_date:e.acquisition_date,notes:e.notes});setModal('equip')}}>✏️</button>
                        <button className="btn btn-danger btn-sm" style={{marginLeft:'4px'}} onClick={()=>deleteEquipment(e.id,`${e.brand} ${e.model}`)}>🗑</button>
                      </td>
                    </tr>
                  ))}
                  {equipment.length===0 && <tr><td colSpan="7" style={{textAlign:'center',padding:'32px',color:'#64748b'}}>Nenhum equipamento cadastrado. Clique em ➕ para adicionar.</td></tr>}
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
                  <table><thead><tr><th>Equipamento</th><th>Nº Série</th><th>Unidade</th><th>OS Realizadas</th><th>Status Preventivo</th><th>Próxima Manutenção</th></tr></thead><tbody>
                    {equipment.map(e=>{
                      const osEquip = orders.filter(o=>o.equip_id===e.id)
                      const last = osEquip.filter(o=>o.type==='Preventiva').slice(-1)[0]
                      const next = last ? (() => { const d = new Date(last.open_date+'T00:00:00'); d.setMonth(d.getMonth()+6); return d })() : null
                      const late = next && next < new Date()
                      return <tr key={e.id}>
                        <td><strong>{e.brand} {e.model}</strong></td>
                        <td className="muted" style={{fontSize:'12px'}}>{e.serial}</td>
                        <td><span className="badge badge-blue">{e.unit||'—'}</span></td>
                        <td><span className="badge badge-gray">{osEquip.length} OS</span></td>
                        <td><span className={`badge badge-${late?'danger':'success'}`}>{late?'⚠ Vencida':'✅ Em Dia'}</span></td>
                        <td className="muted">{next ? next.toLocaleDateString('pt-BR') : '—'}</td>
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
                    <table><thead><tr><th>#OS</th><th>Equipamento</th><th>Nº Série</th><th>Unidade</th><th>Tipo</th><th>Técnico</th><th>Data</th><th>Custo</th><th>Status</th><th>Ações</th></tr></thead><tbody>
                      {orders.filter(o=>{
                        const eq = eqMap[o.equip_id]||''
                        const unit = eqFull[o.equip_id]?.unit||''
                        const serial = eqFull[o.equip_id]?.serial||''
                        const q = search.toLowerCase()
                        return (eq+o.tech+o.description+unit+serial).toLowerCase().includes(q) && (!filters.osStatus || o.status===filters.osStatus)
                      }).map((o,i)=>{
                        const eq = eqFull[o.equip_id]
                        return (
                        <tr key={o.id}>
                          <td className="muted">#{String(i+1).padStart(3,'0')}</td>
                          <td><strong>{eqMap[o.equip_id]||'—'}</strong></td>
                          <td className="muted" style={{fontSize:'12px'}}>{eq?.serial||'—'}</td>
                          <td><span className="badge badge-blue">{eq?.unit||'—'}</span></td>
                          <td><span className="badge badge-gray">{o.type}</span></td>
                          <td className="muted">{o.tech}</td>
                          <td className="muted">{fmtDate(o.open_date)}</td>
                          <td style={{color:'#f59e0b',fontWeight:'700'}}>{fmt(o.cost)}</td>
                          <td><Badge status={o.status}/></td>
                          <td>
                            <button className="btn btn-outline btn-sm" onClick={()=>{setForm({id:o.id,equip_id:o.equip_id,type:o.type,tech:o.tech,open_date:o.open_date,cost:o.cost,status:o.status,description:o.description});setModal('order')}}>✏️</button>
                            <button className="btn btn-danger btn-sm" style={{marginLeft:'4px'}} onClick={()=>deleteOrder(o.id)}>🗑</button>
                          </td>
                        </tr>
                      )})}
                      {!orders.length && <tr><td colSpan="10" style={{textAlign:'center',padding:'32px',color:'#64748b'}}>Nenhuma OS registrada.</td></tr>}
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
                    {evs.slice(0,3).map(e=>{const c=calEventColor(e);return <div key={e.id} title={`${eqMap[e.equip_id]||e.log_type}${e.serial?' · '+e.serial:''}${e.store?' → '+e.store:''}`} style={{fontSize:'10px',padding:'2px 5px',borderRadius:'4px',marginTop:'2px',background:c+'28',color:c,fontWeight:'600',borderLeft:`3px solid ${c}`,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{eqMap[e.equip_id]||e.log_type}</div>})}
                    {evs.length>3 && <div style={{fontSize:'9px',color:'#94a3b8',marginTop:'2px'}}>+{evs.length-3} mais</div>}
                  </div>
                })}
              </div>
            </div>
            <Card title="📋 Eventos do Mês">
              <div className="table-wrap">
                <table><thead><tr><th>Data</th><th>Equipamento</th><th>Nº Série</th><th>Loja</th><th>Tipo</th><th>Descrição</th><th>Ações</th></tr></thead><tbody>
                  {logistics.filter(e=>{const d=new Date((e.event_date||'')+'T00:00:00');return d.getMonth()===calMonth&&d.getFullYear()===calYear}).map(e=>{
                    const serial = e.serial || eqFull[e.equip_id]?.serial || ''
                    const c = calEventColor(e)
                    return (
                    <tr key={e.id}>
                      <td className="muted">{fmtDate(e.event_date)}</td>
                      <td><strong>{eqMap[e.equip_id]||'—'}</strong></td>
                      <td><span style={{fontSize:'12px',fontWeight:'700',color:c,background:c+'18',padding:'2px 8px',borderRadius:'6px',borderLeft:`3px solid ${c}`}}>{serial||'—'}</span></td>
                      <td className="muted">{e.store||'—'}</td>
                      <td><span className="badge badge-blue">{e.log_type}</span></td>
                      <td className="muted">{e.description}</td>
                      <td style={{display:'flex',gap:'4px'}}>
                        <button className="btn btn-outline btn-sm" onClick={()=>{setForm({id:e.id,event_date:e.event_date,log_type:e.log_type,equip_id:e.equip_id||'',description:e.description,store:e.store||'',serial:e.serial||serial});setModal('logistic')}}>✏️</button>
                        <button className="btn btn-danger btn-sm" onClick={async()=>{if(!confirm('Remover evento?'))return;await db.logistics.delete(e.id);reload();showToast('Evento removido.')}}>🗑</button>
                      </td>
                    </tr>
                  )})}
                  {!logistics.filter(e=>{const d=new Date((e.event_date||'')+'T00:00:00');return d.getMonth()===calMonth&&d.getFullYear()===calYear}).length &&
                    <tr><td colSpan="7" style={{textAlign:'center',padding:'24px',color:'#64748b'}}>Nenhum evento este mês.</td></tr>}
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

        {/* ══ ADMINISTRAÇÃO ══ */}
        {page==='admin' && (
          <div>
            <div className="tabs">
              {[['users','👥 Usuários'],['statuses','🔵 Status'],['types','🏷️ Tipos'],['units_tab','🏢 Unidades']].map(([id,label])=>(
                <button key={id} className={`tab-btn${adminTab===id?' active':''}`} onClick={()=>setAdminTab(id)}>{label}</button>
              ))}
            </div>

            {/* ── USUÁRIOS ── */}
            {adminTab==='users' && <>
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
                    {!profiles.length && <tr><td colSpan="6" style={{textAlign:'center',padding:'32px',color:'#94a3b8'}}>Nenhum usuário cadastrado.</td></tr>}
                  </tbody></table>
                </div>
              </div>
            </>}

            {/* ── STATUS ── */}
            {adminTab==='statuses' && <>
              <div className="search-bar">
                <span style={{fontSize:'13px',color:'#64748b',flex:1}}>Gerencie os status disponíveis para os equipamentos.</span>
                <button className="btn btn-primary" onClick={()=>{setForm({});setModal('newStatus')}}>➕ Novo Status</button>
              </div>
              <div className="card" style={{padding:0}}>
                <div className="table-wrap">
                  <table><thead><tr><th>Status</th><th>Cor</th><th>Equipamentos</th><th>Ações</th></tr></thead><tbody>
                    {statuses.map(s=>(
                      <tr key={s.id}>
                        <td><strong style={{display:'flex',alignItems:'center',gap:'8px'}}>
                          <span style={{width:'10px',height:'10px',borderRadius:'50%',background:s.color,display:'inline-block',flexShrink:0}}/>
                          {s.name}
                        </strong></td>
                        <td className="muted">{s.color}</td>
                        <td><span className="badge badge-gray">{equipment.filter(e=>e.status===s.name).length} equip.</span></td>
                        <td>
                          <button className="btn btn-danger btn-sm" onClick={async()=>{
                            if(!confirm(`Excluir status "${s.name}"?`)) return
                            await db.statuses.delete(s.id); reload(); showToast('Status excluído.')
                          }}>🗑</button>
                        </td>
                      </tr>
                    ))}
                    {!statuses.length && <tr><td colSpan="4" style={{textAlign:'center',padding:'32px',color:'#94a3b8'}}>Nenhum status cadastrado.</td></tr>}
                  </tbody></table>
                </div>
              </div>
            </>}

            {/* ── TIPOS ── */}
            {adminTab==='types' && <>
              <div className="search-bar">
                <span style={{fontSize:'13px',color:'#64748b',flex:1}}>Gerencie os tipos de equipamento disponíveis.</span>
                <button className="btn btn-primary" onClick={()=>{setForm({});setModal('newType')}}>➕ Novo Tipo</button>
              </div>
              <div className="card" style={{padding:0}}>
                <div className="table-wrap">
                  <table><thead><tr><th>Tipo</th><th>Equipamentos</th><th>Ações</th></tr></thead><tbody>
                    {eqTypes.map(t=>(
                      <tr key={t.id}>
                        <td><strong>{t.name}</strong></td>
                        <td><span className="badge badge-blue">{equipment.filter(e=>e.type===t.name).length} equip.</span></td>
                        <td>
                          <button className="btn btn-danger btn-sm" onClick={async()=>{
                            if(!confirm(`Excluir tipo "${t.name}"?`)) return
                            await db.equipment_types.delete(t.id); reload(); showToast('Tipo excluído.')
                          }}>🗑</button>
                        </td>
                      </tr>
                    ))}
                    {!eqTypes.length && <tr><td colSpan="3" style={{textAlign:'center',padding:'32px',color:'#94a3b8'}}>Nenhum tipo cadastrado.</td></tr>}
                  </tbody></table>
                </div>
              </div>
            </>}

            {/* ── UNIDADES ── */}
            {adminTab==='units_tab' && <>
              <div className="search-bar">
                <span style={{fontSize:'13px',color:'#64748b',flex:1}}>Unidades da rede — gerencie as filiais e locais.</span>
                <button className="btn btn-primary" onClick={()=>{setForm({});setModal('newUnit')}}>➕ Nova Unidade</button>
              </div>
              <div className="card" style={{padding:0}}>
                <div className="table-wrap">
                  <table><thead><tr><th>Unidade</th><th>Equipamentos</th><th>Status</th><th>Ações</th></tr></thead><tbody>
                    {units.map(u=>(
                      <tr key={u.id}>
                        <td><strong>{u.name}</strong></td>
                        <td><span className="badge badge-blue">{equipment.filter(e=>e.unit===u.name).length} equip.</span></td>
                        <td>
                          <button onClick={async()=>{await db.units.update(u.id,{active:!u.active});reload()}}
                            className={`badge badge-${u.active?'success':'danger'}`} style={{cursor:'pointer',border:'none',fontSize:'12px'}}>
                            {u.active?'✅ Ativa':'❌ Inativa'}
                          </button>
                        </td>
                        <td>
                          <button className="btn btn-danger btn-sm" onClick={async()=>{
                            if(!confirm(`Excluir unidade "${u.name}"?`)) return
                            await db.units.delete(u.id); reload(); showToast('Unidade excluída.')
                          }}>🗑</button>
                        </td>
                      </tr>
                    ))}
                    {!units.length && <tr><td colSpan="4" style={{textAlign:'center',padding:'32px',color:'#94a3b8'}}>Nenhuma unidade cadastrada.</td></tr>}
                  </tbody></table>
                </div>
              </div>
            </>}
          </div>
        )}

        {/* ══ PONTEIRAS ══ */}
        {page==='tips' && (
          <div>
            {/* KPIs */}
            <div className="kpi-grid" style={{marginBottom:'20px'}}>
              <KPI icon="💡" value={tips.filter(t=>t.status==='Ativa').length} label="Ponteiras Ativas" sub={`${tips.length} total cadastradas`} color="#6366f1"/>
              <KPI icon="🔄" value={tips.filter(t=>t.status==='Reserva').length} label="Em Reserva" sub="Disponíveis para uso" color="#8b5cf6"/>
              <KPI icon="⚠️" value={tips.filter(t=>tipAlertPct(t)<=0.2&&t.status!=='Zerada').length} label="Em Alerta (≤20%)" sub="Necessitam reposição" color="#f59e0b"/>
              <KPI icon="🔴" value={tips.filter(t=>t.status==='Zerada').length} label="Zeradas" sub="Sem disparos restantes" color="#ef4444"/>
            </div>

            {/* Alert banner */}
            {tips.filter(t=>tipAlertPct(t)<=0.2).length > 0 && (
              <div style={{background:'#fef3c7',border:'1px solid #f59e0b',borderRadius:'10px',padding:'12px 16px',marginBottom:'16px',display:'flex',alignItems:'center',gap:'10px'}}>
                <span style={{fontSize:'20px'}}>⚠️</span>
                <div>
                  <strong style={{color:'#92400e'}}>Atenção: {tips.filter(t=>tipAlertPct(t)<=0.2).length} ponteira(s) com menos de 20% de disparos!</strong>
                  <div style={{fontSize:'12px',color:'#a16207',marginTop:'2px'}}>
                    {tips.filter(t=>tipAlertPct(t)<=0.2).map(t=>`${t.tip_type} · ${t.serial} (${Math.round(tipAlertPct(t)*100)}%)`).join(' | ')}
                  </div>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="tabs">
              {[['resumo','📊 Resumo'],['ponteiras','💡 Ponteiras'],['movimentacoes','🔄 Movimentações'],['compras','🛒 Compras'],['auditoria','🔍 Auditoria']].map(([k,l])=>(
                <button key={k} className={`tab-btn${tipsTab===k?' active':''}`} onClick={()=>setTipsTab(k)}>{l}</button>
              ))}
            </div>

            {/* ── RESUMO ── */}
            {tipsTab==='resumo' && (
              <div>
                <div className="card" style={{marginBottom:'16px'}}>
                  <div style={{fontWeight:'700',fontSize:'15px',marginBottom:'16px'}}>Estoque por Tipo de Ponteira</div>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead>
                        <tr style={{background:'#f8fafc'}}>
                          <th style={{padding:'10px 12px',textAlign:'left',fontSize:'12px',fontWeight:'700',color:'#64748b',borderBottom:'2px solid #e2e8f0'}}>Tipo</th>
                          <th style={{padding:'10px 12px',textAlign:'center',fontSize:'12px',fontWeight:'700',color:'#64748b',borderBottom:'2px solid #e2e8f0'}}>Total</th>
                          <th style={{padding:'10px 12px',textAlign:'center',fontSize:'12px',fontWeight:'700',color:'#64748b',borderBottom:'2px solid #e2e8f0'}}>Ativas</th>
                          <th style={{padding:'10px 12px',textAlign:'center',fontSize:'12px',fontWeight:'700',color:'#8b5cf6',borderBottom:'2px solid #e2e8f0'}}>Reserva</th>
                          <th style={{padding:'10px 12px',textAlign:'center',fontSize:'12px',fontWeight:'700',color:'#64748b',borderBottom:'2px solid #e2e8f0'}}>⚠️ Alerta</th>
                          <th style={{padding:'10px 12px',textAlign:'center',fontSize:'12px',fontWeight:'700',color:'#ef4444',borderBottom:'2px solid #e2e8f0'}}>Zeradas</th>
                          <th style={{padding:'10px 12px',textAlign:'center',fontSize:'12px',fontWeight:'700',color:'#64748b',borderBottom:'2px solid #e2e8f0'}}>Preço Unit.</th>
                          <th style={{padding:'10px 12px',textAlign:'left',fontSize:'12px',fontWeight:'700',color:'#64748b',borderBottom:'2px solid #e2e8f0'}}>Ponteiras Zeradas (S/N)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {TIP_TYPES.map(tt => {
                          const ofType = tips.filter(t=>t.tip_type===tt)
                          const alert = ofType.filter(t=>tipAlertPct(t)<=0.2&&t.status!=='Zerada')
                          const zero = ofType.filter(t=>t.status==='Zerada')
                          const active = ofType.filter(t=>t.status==='Ativa')
                          const reserva = ofType.filter(t=>t.status==='Reserva')
                          return (
                            <tr key={tt} style={{borderBottom:'1px solid #f1f5f9'}}>
                              <td style={{padding:'12px',fontWeight:'600',fontSize:'13px'}}>{tt}</td>
                              <td style={{padding:'12px',textAlign:'center'}}><span className="badge badge-gray">{ofType.length}</span></td>
                              <td style={{padding:'12px',textAlign:'center'}}><span className="badge badge-success">{active.length}</span></td>
                              <td style={{padding:'12px',textAlign:'center'}}>
                                {reserva.length>0 ? <span className="badge badge-info">{reserva.length}</span> : <span style={{color:'#94a3b8',fontSize:'12px'}}>—</span>}
                              </td>
                              <td style={{padding:'12px',textAlign:'center'}}>
                                {alert.length>0 ? <span className="badge badge-warning">{alert.length}</span> : <span style={{color:'#94a3b8',fontSize:'12px'}}>—</span>}
                              </td>
                              <td style={{padding:'12px',textAlign:'center'}}>
                                {zero.length>0 ? <span className="badge badge-danger">{zero.length}</span> : <span style={{color:'#94a3b8',fontSize:'12px'}}>—</span>}
                              </td>
                              <td style={{padding:'12px',textAlign:'center',fontSize:'13px',color:'#64748b'}}>{fmt(TIP_PRICE[tt]||0)}</td>
                              <td style={{padding:'12px',fontSize:'11px',color:'#64748b',maxWidth:'300px',wordBreak:'break-all'}}>
                                {zero.map(t=>t.serial).join(' · ') || '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Por equipamento */}
                <div className="card">
                  <div style={{fontWeight:'700',fontSize:'15px',marginBottom:'16px'}}>Ponteiras por Equipamento</div>
                  {equipment.map(eq => {
                    const eqTips = tips.filter(t=>t.equipment_id===eq.id)
                    if(!eqTips.length) return null
                    const eqColor = SERIAL_COLORS[eq.serial] || '#6366f1'
                    return (
                      <div key={eq.id} style={{marginBottom:'16px',borderLeft:`3px solid ${eqColor}`,paddingLeft:'12px'}}>
                        <div style={{fontWeight:'700',fontSize:'13px',color:eqColor,marginBottom:'8px'}}>
                          {eq.brand} {eq.model} · S/N {eq.serial}
                        </div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
                          {eqTips.map(t => {
                            const pct = tipAlertPct(t)
                            const barColor = t.status==='Zerada' ? '#ef4444' : pct<=0.2 ? '#f59e0b' : '#10b981'
                            return (
                              <div key={t.id} style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:'8px',padding:'10px 14px',minWidth:'180px'}}>
                                <div style={{fontSize:'12px',fontWeight:'700',marginBottom:'4px'}}>{t.tip_type}</div>
                                <div style={{fontSize:'11px',color:'#64748b',marginBottom:'6px'}}>{t.serial}</div>
                                <div style={{background:'#e2e8f0',borderRadius:'4px',height:'6px',marginBottom:'4px'}}>
                                  <div style={{background:barColor,height:'6px',borderRadius:'4px',width:`${Math.min(100,Math.round(pct*100))}%`}}/>
                                </div>
                                <div style={{fontSize:'11px',color:barColor,fontWeight:'600'}}>{t.current_shots.toLocaleString('pt-BR')} / {t.total_shots.toLocaleString('pt-BR')} ({Math.round(pct*100)}%)</div>
                                {t.current_unit && <div style={{fontSize:'10px',color:'#94a3b8',marginTop:'2px'}}>📍 {t.current_unit}</div>}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                  {tips.filter(t=>!t.equipment_id).length > 0 && (
                    <div style={{borderLeft:'3px solid #94a3b8',paddingLeft:'12px'}}>
                      <div style={{fontWeight:'700',fontSize:'13px',color:'#64748b',marginBottom:'8px'}}>Sem Equipamento Vinculado</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
                        {tips.filter(t=>!t.equipment_id).map(t=>{
                          const pct = tipAlertPct(t)
                          const barColor = t.status==='Zerada'?'#ef4444':pct<=0.2?'#f59e0b':'#10b981'
                          return (
                            <div key={t.id} style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:'8px',padding:'10px 14px',minWidth:'180px'}}>
                              <div style={{fontSize:'12px',fontWeight:'700',marginBottom:'4px'}}>{t.tip_type}</div>
                              <div style={{fontSize:'11px',color:'#64748b',marginBottom:'6px'}}>{t.serial}</div>
                              <div style={{background:'#e2e8f0',borderRadius:'4px',height:'6px',marginBottom:'4px'}}>
                                <div style={{background:barColor,height:'6px',borderRadius:'4px',width:`${Math.min(100,Math.round(pct*100))}%`}}/>
                              </div>
                              <div style={{fontSize:'11px',color:barColor,fontWeight:'600'}}>{t.current_shots.toLocaleString('pt-BR')} / {t.total_shots.toLocaleString('pt-BR')} ({Math.round(pct*100)}%)</div>
                              {t.current_unit && <div style={{fontSize:'10px',color:'#94a3b8',marginTop:'2px'}}>📍 {t.current_unit}</div>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {!tips.length && <Empty icon="💡" msg="Nenhuma ponteira cadastrada ainda."/>}
                </div>
              </div>
            )}

            {/* ── PONTEIRAS ── */}
            {tipsTab==='ponteiras' && (
              <div>
                <div className="search-bar">
                  <span style={{fontSize:'13px',color:'#64748b',flex:1}}>Ponteiras agrupadas por equipamento UC.</span>
                  <button className="btn btn-primary" onClick={()=>{setForm({});setModal('newTip')}}>➕ Nova Ponteira</button>
                </div>
                {UC_EQUIP.map(uc => {
                  const ucEq = equipment.find(e=>e.serial===uc.serial)
                  const ucTips = tips.filter(t=>t.equipment_id===ucEq?.id)
                  const unlinked = uc === UC_EQUIP[UC_EQUIP.length-1] ? tips.filter(t=>!t.equipment_id) : []
                  const allTips = [...ucTips, ...unlinked]
                  return (
                    <div key={uc.serial} style={{marginBottom:'20px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 16px',background:uc.color+'18',border:`1px solid ${uc.color}44`,borderRadius:'10px 10px 0 0',borderBottom:'none'}}>
                        <span style={{width:'14px',height:'14px',borderRadius:'50%',background:uc.color,display:'inline-block',flexShrink:0}}/>
                        <strong style={{color:uc.color,fontSize:'14px'}}>{uc.label}</strong>
                        {ucEq && <span style={{fontSize:'12px',color:'#64748b'}}>· {ucEq.brand} {ucEq.model} · S/N {uc.serial}</span>}
                        <span className="badge badge-gray" style={{marginLeft:'auto'}}>{allTips.length} ponteiras</span>
                      </div>
                      <div className="card" style={{padding:0,borderRadius:'0 0 10px 10px',borderTop:'none'}}>
                        <div className="table-wrap">
                          <table><thead><tr><th>Tipo</th><th>N° Série</th><th>% Restante</th><th>Disparos</th><th>Status</th><th>Unidade Atual</th><th>Pedido</th><th>Ações</th></tr></thead>
                          <tbody>
                            {allTips.length ? allTips.map(t=>{
                              const pct = tipAlertPct(t)
                              const barColor = t.status==='Zerada'?'#ef4444':pct<=0.2?'#f59e0b':'#10b981'
                              return (
                                <tr key={t.id} style={pct<=0.2?{background:'#fffbeb'}:{}}>
                                  <td><strong>{t.tip_type}</strong></td>
                                  <td style={{fontSize:'11px',fontFamily:'monospace',color:'#475569'}}>{t.serial}</td>
                                  <td>
                                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                                      <div style={{background:'#e2e8f0',borderRadius:'4px',height:'8px',width:'80px',flexShrink:0}}>
                                        <div style={{background:barColor,height:'8px',borderRadius:'4px',width:`${Math.min(100,Math.round(pct*100))}%`}}/>
                                      </div>
                                      <span style={{fontSize:'11px',color:barColor,fontWeight:'700'}}>{Math.round(pct*100)}%</span>
                                    </div>
                                  </td>
                                  <td style={{fontSize:'12px'}}><strong style={{color:barColor}}>{t.current_shots?.toLocaleString('pt-BR')}</strong><span style={{color:'#94a3b8'}}> / {t.total_shots?.toLocaleString('pt-BR')}</span></td>
                                  <td><span className={`badge badge-${t.status==='Zerada'?'danger':t.status==='Alerta'?'warning':t.status==='Reserva'?'info':'success'}`}>{t.status==='Alerta'?'⚠️ ':''}{t.status}</span></td>
                                  <td className="muted" style={{fontSize:'12px'}}>{t.current_unit||'—'}</td>
                                  <td className="muted" style={{fontSize:'11px'}}>{t.purchase_order||'—'}</td>
                                  <td><div style={{display:'flex',gap:'4px'}}>
                                    <button className="btn btn-outline btn-sm" onClick={()=>{setForm({...t});setModal('newTip')}}>✏️</button>
                                    <button className="btn btn-danger btn-sm" onClick={()=>deleteTip(t.id)}>🗑</button>
                                  </div></td>
                                </tr>
                              )
                            }) : <tr><td colSpan="8" style={{textAlign:'center',padding:'20px',color:'#94a3b8',fontSize:'13px'}}>Nenhuma ponteira vinculada a este equipamento.</td></tr>}
                          </tbody></table>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── MOVIMENTAÇÕES ── */}
            {tipsTab==='movimentacoes' && (
              <div>
                <div className="search-bar">
                  <span style={{fontSize:'13px',color:'#64748b',flex:1}}>Controle de disparos por unidade e tipo de ponteira.</span>
                  <button className="btn btn-primary" onClick={()=>{setForm({movement_date:today()});setModal('newMovement')}}>➕ Nova Visita</button>
                </div>
                {/* Filtro por UC */}
                <div style={{display:'flex',gap:'8px',marginBottom:'16px',flexWrap:'wrap'}}>
                  {[{serial:'',label:'Todas as UCs',color:'#6366f1'},...UC_EQUIP].map(uc=>(
                    <button key={uc.serial} className={`btn btn-sm ${filters.movUC===uc.serial?'btn-primary':'btn-outline'}`}
                      style={filters.movUC===uc.serial?{background:uc.color,borderColor:uc.color}:{borderColor:uc.color,color:uc.color}}
                      onClick={()=>setFilters(f=>({...f,movUC:uc.serial}))}>
                      {uc.label}
                    </button>
                  ))}
                </div>
                <div className="card" style={{padding:0}}>
                  <div className="table-wrap">
                    <table style={{borderCollapse:'collapse',width:'100%'}}>
                      <thead>
                        <tr style={{background:'#f8fafc'}}>
                          <th rowSpan="2" style={{padding:'10px 12px',textAlign:'left',fontSize:'11px',fontWeight:'700',color:'#64748b',borderBottom:'2px solid #e2e8f0',whiteSpace:'nowrap'}}>Data</th>
                          <th rowSpan="2" style={{padding:'10px 12px',textAlign:'left',fontSize:'11px',fontWeight:'700',color:'#64748b',borderBottom:'2px solid #e2e8f0'}}>Unidade</th>
                          <th rowSpan="2" style={{padding:'10px 12px',textAlign:'left',fontSize:'11px',fontWeight:'700',color:'#64748b',borderBottom:'2px solid #e2e8f0'}}>UC</th>
                          <th rowSpan="2" style={{padding:'10px 8px',textAlign:'center',fontSize:'11px',fontWeight:'700',color:'#64748b',borderBottom:'2px solid #e2e8f0'}}>Fluxo</th>
                          {TIP_COLS.map(c=>(
                            <th key={c.key} style={{padding:'6px 10px',textAlign:'center',fontSize:'11px',fontWeight:'700',color:'#64748b',borderBottom:'2px solid #e2e8f0',whiteSpace:'pre-line',minWidth:'70px'}}>{c.label}</th>
                          ))}
                          <th rowSpan="2" style={{padding:'10px 12px',textAlign:'left',fontSize:'11px',fontWeight:'700',color:'#64748b',borderBottom:'2px solid #e2e8f0'}}>Obs</th>
                          <th rowSpan="2" style={{padding:'10px 8px',fontSize:'11px',fontWeight:'700',color:'#64748b',borderBottom:'2px solid #e2e8f0'}}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tipMovements
                          .filter(m => !filters.movUC || m.equipment?.serial === filters.movUC)
                          .map(m=>{
                          const ucInfo = UC_EQUIP.find(u=>u.serial===m.equipment?.serial)
                          const ucColor = ucInfo?.color || '#6366f1'
                          const periodo = m.date_out
                            ? `${fmtDate(m.movement_date)} a ${fmtDate(m.date_out)}`
                            : `${fmtDate(m.movement_date)} — em uso`
                          return (
                          <React.Fragment key={m.id}>
                            {/* Linha Chegada */}
                            <tr style={{borderTop:'2px solid #e2e8f0',background:'#f0fdf4'}}>
                              <td rowSpan="3" style={{padding:'8px 12px',verticalAlign:'middle',fontSize:'12px',fontWeight:'600',whiteSpace:'nowrap',borderRight:'1px solid #e2e8f0',color:'#475569'}}>{periodo}</td>
                              <td rowSpan="3" style={{padding:'8px 12px',verticalAlign:'middle',fontWeight:'600',borderRight:'1px solid #e2e8f0'}}>{m.unit}</td>
                              <td rowSpan="3" style={{padding:'8px 10px',verticalAlign:'middle',borderRight:'1px solid #e2e8f0'}}>
                                {ucInfo && <span style={{background:ucColor+'22',color:ucColor,padding:'3px 8px',borderRadius:'6px',fontSize:'11px',fontWeight:'700',border:`1px solid ${ucColor}44`}}>{ucInfo.label}</span>}
                              </td>
                              <td style={{padding:'6px 8px',textAlign:'center',fontSize:'11px',fontWeight:'700',color:'#059669',background:'#f0fdf4',borderRight:'1px solid #e2e8f0'}}>Chegada</td>
                              {TIP_COLS.map(c=>{
                                const v = m[`shots_${c.key}_in`]
                                return <td key={c.key} style={{padding:'6px 10px',textAlign:'center',fontSize:'13px',fontWeight:'600',color:v!=null?'#1e293b':'#cbd5e1',background:'#f0fdf4'}}>{v!=null?v.toLocaleString('pt-BR'):'—'}</td>
                              })}
                              <td rowSpan="3" style={{padding:'8px 12px',verticalAlign:'middle',fontSize:'11px',color:'#64748b',maxWidth:'150px',borderLeft:'1px solid #e2e8f0'}}>{m.notes||'—'}</td>
                              <td rowSpan="3" style={{padding:'8px 8px',verticalAlign:'middle',borderLeft:'1px solid #e2e8f0'}}>
                                <div style={{display:'flex',gap:'4px',flexDirection:'column'}}>
                                  <button className="btn btn-outline btn-sm" onClick={()=>setForm({...m,shots_13l_in:m.shots_13l_in??'',shots_13l_out:m.shots_13l_out??'',shots_9l_in:m.shots_9l_in??'',shots_9l_out:m.shots_9l_out??'',shots_6l_in:m.shots_6l_in??'',shots_6l_out:m.shots_6l_out??'',shots_45d_in:m.shots_45d_in??'',shots_45d_out:m.shots_45d_out??'',shots_3d_in:m.shots_3d_in??'',shots_3d_out:m.shots_3d_out??'',shots_2d_in:m.shots_2d_in??'',shots_2d_out:m.shots_2d_out??''})||setModal('newMovement')}>✏️</button>
                                  <button className="btn btn-danger btn-sm" onClick={async()=>{if(!confirm('Remover visita?'))return;await db.tip_movements.delete(m.id);showToast('Removido.');reload()}}>🗑</button>
                                </div>
                              </td>
                            </tr>
                            {/* Linha Saída */}
                            <tr style={{background:'#fffbeb'}}>
                              <td style={{padding:'6px 8px',textAlign:'center',fontSize:'11px',fontWeight:'700',color:'#d97706',background:'#fffbeb',borderRight:'1px solid #e2e8f0'}}>Saída</td>
                              {TIP_COLS.map(c=>{
                                const v = m[`shots_${c.key}_out`]
                                return <td key={c.key} style={{padding:'6px 10px',textAlign:'center',fontSize:'13px',fontWeight:'600',color:v!=null?'#1e293b':'#cbd5e1',background:'#fffbeb'}}>{v!=null?v.toLocaleString('pt-BR'):'—'}</td>
                              })}
                            </tr>
                            {/* Linha Disparos utilizados */}
                            <tr style={{background:'#fef2f2',borderBottom:'2px solid #e2e8f0'}}>
                              <td style={{padding:'6px 8px',textAlign:'center',fontSize:'10px',fontWeight:'700',color:'#dc2626',background:'#fef2f2',borderRight:'1px solid #e2e8f0',whiteSpace:'nowrap'}}>Disparos<br/>utilizados</td>
                              {TIP_COLS.map(c=>{
                                const inV = m[`shots_${c.key}_in`]
                                const outV = m[`shots_${c.key}_out`]
                                const used = (inV!=null && outV!=null) ? inV - outV : null
                                const isRed = used != null && used < 0
                                return <td key={c.key} style={{padding:'6px 10px',textAlign:'center',fontSize:'12px',fontWeight:'700',color:used!=null?(isRed?'#dc2626':'#dc2626'):'#cbd5e1',background:'#fef2f2'}}>{used!=null?used.toLocaleString('pt-BR'):'—'}</td>
                              })}
                            </tr>
                          </React.Fragment>
                        )})}
                        {!tipMovements.filter(m=>!filters.movUC||m.equipment?.serial===filters.movUC).length &&
                          <tr><td colSpan={4+TIP_COLS.length+2} style={{textAlign:'center',padding:'32px',color:'#94a3b8'}}>Nenhuma visita registrada.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── COMPRAS ── */}
            {tipsTab==='compras' && (
              <div>
                <div className="search-bar">
                  <span style={{fontSize:'13px',color:'#64748b',flex:1}}>Controle de pedidos e compras de ponteiras.</span>
                  <button className="btn btn-primary" onClick={()=>{setForm({purchase_date:today()});setModal('newPurchase')}}>➕ Registrar Compra</button>
                </div>
                <div className="card" style={{marginBottom:'16px'}}>
                  <div style={{display:'flex',gap:'24px',flexWrap:'wrap'}}>
                    <div><div style={{fontSize:'11px',color:'#64748b',marginBottom:'2px'}}>Total investido</div>
                      <div style={{fontSize:'22px',fontWeight:'800',color:'#1e293b'}}>{fmt(tipPurchases.reduce((s,p)=>s+(parseFloat(p.price)||0),0))}</div>
                    </div>
                    <div><div style={{fontSize:'11px',color:'#64748b',marginBottom:'2px'}}>DOT (R$ 5.000/un)</div>
                      <div style={{fontSize:'18px',fontWeight:'700',color:'#6366f1'}}>{tipPurchases.filter(p=>p.tip_type?.includes('DOT')).reduce((s,p)=>s+(parseInt(p.quantity)||0),0)} un</div>
                    </div>
                    <div><div style={{fontSize:'11px',color:'#64748b',marginBottom:'2px'}}>LINEAR (R$ 9.000/un)</div>
                      <div style={{fontSize:'18px',fontWeight:'700',color:'#0ea5e9'}}>{tipPurchases.filter(p=>p.tip_type?.includes('LINEAR')).reduce((s,p)=>s+(parseInt(p.quantity)||0),0)} un</div>
                    </div>
                  </div>
                </div>
                <div className="card" style={{padding:0}}>
                  <div className="table-wrap">
                    <table><thead><tr><th>Pedido</th><th>Data</th><th>Tipo</th><th>N° Série</th><th>Qtd</th><th>Valor</th><th>Observações</th><th>Ações</th></tr></thead>
                    <tbody>
                      {tipPurchases.map(p=>(
                        <tr key={p.id}>
                          <td><strong style={{fontFamily:'monospace',fontSize:'12px'}}>{p.purchase_number}</strong></td>
                          <td className="muted">{fmtDate(p.purchase_date)}</td>
                          <td><span className="badge badge-blue">{p.tip_type||'—'}</span></td>
                          <td style={{fontSize:'11px',fontFamily:'monospace'}}>{p.serial||'—'}</td>
                          <td style={{textAlign:'center'}}>{p.quantity||1}</td>
                          <td><strong>{fmt(p.price)}</strong></td>
                          <td className="muted" style={{fontSize:'11px'}}>{p.notes||'—'}</td>
                          <td>
                            <div style={{display:'flex',gap:'4px'}}>
                              <button className="btn btn-outline btn-sm" onClick={()=>{setForm({...p});setModal('newPurchase')}}>✏️</button>
                              <button className="btn btn-danger btn-sm" onClick={async()=>{
                                if(!confirm('Remover compra?')) return
                                await db.tip_purchases.delete(p.id); showToast('Removido.'); reload()
                              }}>🗑</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!tipPurchases.length && <tr><td colSpan="8" style={{textAlign:'center',padding:'32px',color:'#94a3b8'}}>Nenhuma compra registrada.</td></tr>}
                    </tbody></table>
                  </div>
                </div>
              </div>
            )}

            {/* ── AUDITORIA ── */}
            {tipsTab==='auditoria' && (
              <div>
                <div className="search-bar">
                  <span style={{fontSize:'13px',color:'#64748b',flex:1}}>Auditoria semanal: disparos × serviços realizados por unidade.</span>
                  <div style={{display:'flex',gap:'8px'}}>
                    <button className="btn btn-outline" onClick={pickAuditUnit}>🎲 Sortear Unidade da Semana</button>
                    <button className="btn btn-primary" onClick={()=>{setForm({audit_week:today(),movement_type:'Auditoria'});setModal('auditoria')}}>➕ Nova Auditoria</button>
                  </div>
                </div>

                {/* Semana atual */}
                {(()=>{
                  const week = new Date(); week.setDate(week.getDate()-week.getDay())
                  const weekStr = week.toISOString().split('T')[0]
                  const cur = tipAudits.find(a=>a.audit_week===weekStr)
                  const wn = Math.floor(week / (7*24*3600*1000))
                  const sorteada = LOJAS_TIP[wn % LOJAS_TIP.length]
                  return (
                    <div style={{background: cur ? (cur.status==='Divergência'?'#fef2f2':'#f0fdf4') : '#eff6ff',border:`1px solid ${cur?(cur.status==='Divergência'?'#fecaca':'#bbf7d0'):'#bfdbfe'}`,borderRadius:'10px',padding:'14px 18px',marginBottom:'16px',display:'flex',alignItems:'center',gap:'12px',flexWrap:'wrap'}}>
                      <span style={{fontSize:'24px'}}>{cur?'📋':'🎯'}</span>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:'700',color:'#1e293b',fontSize:'14px'}}>
                          {cur ? `Auditoria desta semana: ${cur.unit} — ${cur.status}` : `Unidade sorteada esta semana: ${sorteada}`}
                        </div>
                        <div style={{fontSize:'12px',color:'#64748b',marginTop:'2px'}}>
                          {cur ? `${cur.services_count} serviços · ${cur.actual_shots} disparos reais · ${cur.expected_shots} esperados` : 'Clique em "Sortear Unidade" para confirmar e iniciar a auditoria'}
                        </div>
                      </div>
                      {!cur && <button className="btn btn-primary btn-sm" onClick={pickAuditUnit}>Iniciar Auditoria</button>}
                    </div>
                  )
                })()}

                <div className="card" style={{padding:0}}>
                  <div className="table-wrap">
                    <table><thead><tr><th>Semana</th><th>Unidade</th><th>Ponteira</th><th>Serviços</th><th>Disp./Sessão</th><th>Esperados</th><th>Reais</th><th>Diferença</th><th>Status</th></tr></thead>
                    <tbody>
                      {tipAudits.map(a=>{
                        const diff = a.expected_shots - a.actual_shots
                        const pct = a.expected_shots > 0 ? Math.abs(diff)/a.expected_shots*100 : 0
                        return (
                          <tr key={a.id}>
                            <td className="muted">{fmtDate(a.audit_week)}</td>
                            <td><strong>{a.unit}</strong></td>
                            <td style={{fontSize:'11px'}}>{a.tip_type||'—'}<br/><span style={{color:'#94a3b8',fontSize:'10px'}}>{a.tips?.serial||''}</span></td>
                            <td style={{textAlign:'center'}}>{a.services_count}</td>
                            <td style={{textAlign:'center'}}>{a.shots_per_session}</td>
                            <td style={{textAlign:'center',fontWeight:'600'}}>{a.expected_shots?.toLocaleString('pt-BR')}</td>
                            <td style={{textAlign:'center',fontWeight:'600'}}>{a.actual_shots?.toLocaleString('pt-BR')}</td>
                            <td style={{textAlign:'center',color:Math.abs(diff)>0?'#ef4444':'#10b981',fontWeight:'700'}}>
                              {diff!==0?(diff>0?'+':'')+diff.toLocaleString('pt-BR')+` (${Math.round(pct)}%)`:'OK'}
                            </td>
                            <td><span className={`badge badge-${a.status==='Concluída'?'success':a.status==='Divergência'?'danger':'warning'}`}>{a.status}</span></td>
                          </tr>
                        )
                      })}
                      {!tipAudits.length && <tr><td colSpan="9" style={{textAlign:'center',padding:'32px',color:'#94a3b8'}}>Nenhuma auditoria registrada.</td></tr>}
                    </tbody></table>
                  </div>
                </div>
              </div>
            )}
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

            {/* ── Nova Ponteira ── */}
            {modal==='newTip' && <>
              <h2>{form.id?'✏️ Editar Ponteira':'💡 Nova Ponteira'}</h2>
              <div className="form-row">
                <FG label="Tipo de Ponteira">
                  <select className="fi" value={form.tip_type||''} onChange={e=>setForm(f=>({...f,tip_type:e.target.value,total_shots:TIP_MAX_SHOTS[e.target.value]||10000,current_shots:f.id?f.current_shots:(TIP_MAX_SHOTS[e.target.value]||10000),price:TIP_PRICE[e.target.value]||5000}))}>
                    <option value="">— Selecione —</option>
                    {TIP_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </FG>
                <FG label="N° de Série"><input className="fi" value={form.serial||''} onChange={e=>setForm(f=>({...f,serial:e.target.value}))} placeholder="Ex: A01698A00-23071440058KJ"/></FG>
              </div>
              <div className="form-row">
                <FG label="Equipamento Vinculado">
                  <select className="fi" value={form.equipment_id||''} onChange={e=>setForm(f=>({...f,equipment_id:e.target.value}))}>
                    <option value="">— Nenhum —</option>
                    {equipment.map(e=><option key={e.id} value={e.id}>{e.brand} {e.model} · {e.serial}</option>)}
                  </select>
                </FG>
                <FG label="Unidade Atual">
                  <select className="fi" value={form.current_unit||''} onChange={e=>setForm(f=>({...f,current_unit:e.target.value}))}>
                    <option value="">— Selecione —</option>
                    {LOJAS_TIP.map(l=><option key={l}>{l}</option>)}
                  </select>
                </FG>
              </div>
              <div className="form-row">
                <FG label="Total de Disparos"><input className="fi" type="number" value={form.total_shots||''} onChange={e=>setForm(f=>({...f,total_shots:e.target.value}))}/></FG>
                <FG label="Disparos Atuais"><input className="fi" type="number" value={form.current_shots||''} onChange={e=>setForm(f=>({...f,current_shots:e.target.value}))}/></FG>
              </div>
              <FG label="Pedido de Compra"><input className="fi" value={form.purchase_order||''} onChange={e=>setForm(f=>({...f,purchase_order:e.target.value}))} placeholder="Ex: PEDIDO C030_2026"/></FG>
              <div className="form-row">
                <FG label="Status">
                  <select className="fi" value={form.status||'Ativa'} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                    {['Ativa','Reserva','Alerta','Zerada'].map(s=><option key={s}>{s}</option>)}
                  </select>
                </FG>
                <FG label="Preço (R$)"><input className="fi" type="number" value={form.price||''} onChange={e=>setForm(f=>({...f,price:e.target.value}))}/></FG>
              </div>
              <FG label="Observações"><textarea className="fi" rows="2" value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></FG>
              <ModalActions onCancel={()=>setModal(null)} onSave={saveTip}/>
            </>}

            {/* ── Visita de Ponteiras (matriz) ── */}
            {modal==='newMovement' && <>
              <h2 style={{fontSize:'16px'}}>{form.id?'✏️ Editar Visita':'🔄 Registrar Visita de Ponteiras'}</h2>
              <div className="form-row">
                <FG label="Equipamento (UC)">
                  <select className="fi" value={form.equipment_id||''} onChange={e=>setForm(f=>({...f,equipment_id:e.target.value}))}>
                    <option value="">— Selecione —</option>
                    {UC_EQUIP.map(uc=>{
                      const eq=equipment.find(e=>e.serial===uc.serial)
                      return eq ? <option key={uc.serial} value={eq.id}>{uc.label} · S/N {uc.serial}</option> : null
                    })}
                  </select>
                </FG>
                <FG label="Loja / Unidade">
                  <select className="fi" value={form.unit||''} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}>
                    <option value="">— Selecione —</option>
                    {LOJAS_TIP.filter(l=>l!=='Estoque').map(l=><option key={l}>{l}</option>)}
                  </select>
                </FG>
              </div>
              <div className="form-row">
                <FG label="Data de Entrada"><input className="fi" type="date" value={form.movement_date||''} onChange={e=>setForm(f=>({...f,movement_date:e.target.value}))}/></FG>
                <FG label="Data de Saída (opcional)"><input className="fi" type="date" value={form.date_out||''} onChange={e=>setForm(f=>({...f,date_out:e.target.value}))}/></FG>
              </div>
              {/* Tabela de disparos por tipo */}
              <div style={{marginBottom:'12px'}}>
                <div style={{fontSize:'12px',fontWeight:'700',color:'#64748b',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'.5px'}}>Disparos por tipo de ponteira</div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead>
                      <tr>
                        <th style={{padding:'8px',fontSize:'11px',color:'#64748b',fontWeight:'700',textAlign:'left',borderBottom:'1px solid #334155',width:'110px'}}>Fluxo</th>
                        {TIP_COLS.map(c=><th key={c.key} style={{padding:'8px',fontSize:'10px',color:'#94a3b8',fontWeight:'700',textAlign:'center',borderBottom:'1px solid #334155',whiteSpace:'pre-line'}}>{c.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{background:'rgba(16,185,129,.06)'}}>
                        <td style={{padding:'8px',fontSize:'12px',fontWeight:'700',color:'#059669'}}>Chegada</td>
                        {TIP_COLS.map(c=>(
                          <td key={c.key} style={{padding:'4px'}}>
                            <input className="fi" type="number" min="0" value={form[`shots_${c.key}_in`]??''} onChange={e=>setForm(f=>({...f,[`shots_${c.key}_in`]:e.target.value}))} style={{textAlign:'center',padding:'6px 4px',fontSize:'12px'}} placeholder="—"/>
                          </td>
                        ))}
                      </tr>
                      <tr style={{background:'rgba(245,158,11,.06)'}}>
                        <td style={{padding:'8px',fontSize:'12px',fontWeight:'700',color:'#d97706'}}>Saída</td>
                        {TIP_COLS.map(c=>(
                          <td key={c.key} style={{padding:'4px'}}>
                            <input className="fi" type="number" min="0" value={form[`shots_${c.key}_out`]??''} onChange={e=>setForm(f=>({...f,[`shots_${c.key}_out`]:e.target.value}))} style={{textAlign:'center',padding:'6px 4px',fontSize:'12px'}} placeholder="—"/>
                          </td>
                        ))}
                      </tr>
                      <tr style={{background:'rgba(239,68,68,.06)'}}>
                        <td style={{padding:'8px',fontSize:'11px',fontWeight:'700',color:'#dc2626'}}>Utilizados</td>
                        {TIP_COLS.map(c=>{
                          const inV = parseInt(form[`shots_${c.key}_in`])||0
                          const outV = parseInt(form[`shots_${c.key}_out`])||0
                          const used = (form[`shots_${c.key}_in`]&&form[`shots_${c.key}_out`]) ? inV-outV : null
                          return <td key={c.key} style={{padding:'8px',textAlign:'center',fontSize:'12px',fontWeight:'700',color:used!=null?'#dc2626':'#475569'}}>{used!=null?used.toLocaleString('pt-BR'):'—'}</td>
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <FG label="Observações"><textarea className="fi" rows="2" value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></FG>
              <ModalActions onCancel={()=>setModal(null)} onSave={saveTipMovement}/>
            </>}

            {/* ── Compra de Ponteira ── */}
            {modal==='newPurchase' && <>
              <h2>{form.id?'✏️ Editar Compra':'🛒 Registrar Compra de Ponteira'}</h2>
              <div className="form-row">
                <FG label="N° do Pedido"><input className="fi" value={form.purchase_number||''} onChange={e=>setForm(f=>({...f,purchase_number:e.target.value}))} placeholder="Ex: PEDIDO C031_2026"/></FG>
                <FG label="Data da Compra"><input className="fi" type="date" value={form.purchase_date||''} onChange={e=>setForm(f=>({...f,purchase_date:e.target.value}))}/></FG>
              </div>
              <div className="form-row">
                <FG label="Tipo de Ponteira">
                  <select className="fi" value={form.tip_type||''} onChange={e=>setForm(f=>({...f,tip_type:e.target.value,price:TIP_PRICE[e.target.value]||0}))}>
                    <option value="">— Selecione —</option>
                    {TIP_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </FG>
                <FG label="Quantidade"><input className="fi" type="number" min="1" value={form.quantity||1} onChange={e=>setForm(f=>({...f,quantity:e.target.value}))}/></FG>
              </div>
              <div className="form-row">
                <FG label="N° de Série(s)"><input className="fi" value={form.serial||''} onChange={e=>setForm(f=>({...f,serial:e.target.value}))} placeholder="Ex: A01697A00-..."/></FG>
                <FG label="Valor Total (R$)"><input className="fi" type="number" value={form.price||''} onChange={e=>setForm(f=>({...f,price:e.target.value}))}/></FG>
              </div>
              <FG label="Observações"><textarea className="fi" rows="2" value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></FG>
              <ModalActions onCancel={()=>setModal(null)} onSave={saveTipPurchase}/>
            </>}

            {/* ── Auditoria Semanal ── */}
            {modal==='auditoria' && <>
              <h2>🔍 Auditoria Semanal de Ponteiras</h2>
              <div className="form-row">
                <FG label="Semana (início)"><input className="fi" type="date" value={form.audit_week||''} onChange={e=>setForm(f=>({...f,audit_week:e.target.value}))}/></FG>
                <FG label="Unidade Auditada">
                  <select className="fi" value={form.unit||''} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}>
                    <option value="">— Selecione —</option>
                    {LOJAS_TIP.filter(l=>l!=='Estoque').map(l=><option key={l}>{l}</option>)}
                  </select>
                </FG>
              </div>
              <div className="form-row">
                <FG label="Ponteira">
                  <select className="fi" value={form.tip_id||''} onChange={e=>{const t=tips.find(x=>x.id===e.target.value);setForm(f=>({...f,tip_id:e.target.value,tip_type:t?.tip_type||''}))}}>
                    <option value="">— Selecione —</option>
                    {tips.map(t=><option key={t.id} value={t.id}>{t.tip_type} · {t.serial}</option>)}
                  </select>
                </FG>
                <FG label="Tipo de Ponteira"><input className="fi" value={form.tip_type||''} readOnly style={{opacity:.7}}/></FG>
              </div>
              <div className="form-row">
                <FG label="Serviços Realizados"><input className="fi" type="number" min="0" value={form.services_count||''} onChange={e=>setForm(f=>({...f,services_count:e.target.value}))} placeholder="Qtd de sessões"/></FG>
                <FG label="Disparos por Sessão"><input className="fi" type="number" min="0" value={form.shots_per_session||''} onChange={e=>setForm(f=>({...f,shots_per_session:e.target.value}))} placeholder="Padrão da sessão"/></FG>
              </div>
              <FG label="Disparos Reais Utilizados (contador do equipamento)">
                <input className="fi" type="number" min="0" value={form.actual_shots||''} onChange={e=>setForm(f=>({...f,actual_shots:e.target.value}))} placeholder="Disparos confirmados"/>
              </FG>
              {form.services_count && form.shots_per_session && (
                <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:'8px',padding:'10px 14px',fontSize:'13px',marginBottom:'12px'}}>
                  <strong>Disparos esperados:</strong> {parseInt(form.services_count||0)*parseInt(form.shots_per_session||0)} shots
                  {form.actual_shots && <span style={{color: Math.abs(parseInt(form.actual_shots)-parseInt(form.services_count||0)*parseInt(form.shots_per_session||0))/(parseInt(form.services_count||0)*parseInt(form.shots_per_session||0)||1)>0.1?'#ef4444':'#10b981',marginLeft:'12px',fontWeight:'700'}}>
                    Diferença: {parseInt(form.actual_shots)-(parseInt(form.services_count||0)*parseInt(form.shots_per_session||0))} shots
                  </span>}
                </div>
              )}
              <FG label="Observações"><textarea className="fi" rows="2" value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></FG>
              <ModalActions onCancel={()=>setModal(null)} onSave={saveTipAudit}/>
            </>}

            {/* Equipamento */}
            {(modal==='equip') && <>
              <h2>{form.id ? '✏️ Editar Equipamento' : '➕ Adicionar Equipamento'}</h2>
              <div className="form-row">
                <FG label="Marca"><input className="fi" value={form.brand||''} onChange={e=>setForm(f=>({...f,brand:e.target.value}))} placeholder="Ex: Quanta"/></FG>
                <FG label="Modelo"><input className="fi" value={form.model||''} onChange={e=>setForm(f=>({...f,model:e.target.value}))} placeholder="Ex: Q-Plus Evo"/></FG>
              </div>
              <div className="form-row">
                <FG label="Nº de Série"><input className="fi" value={form.serial||''} onChange={e=>setForm(f=>({...f,serial:e.target.value}))} placeholder="Ex: QNT-001-2024"/></FG>
                <FG label="Tipo"><select className="fi" value={form.type||''} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                  <option value="">— Selecione —</option>
                  {eqTypes.map(t=><option key={t.id}>{t.name}</option>)}
                </select></FG>
              </div>
              <div className="form-row">
                <FG label="Unidade"><select className="fi" value={form.unit||''} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}>
                  <option value="">— Selecione a unidade —</option>
                  {units.map(u=><option key={u.id} value={u.name}>{u.name}{!u.active?' (Inativa)':''}</option>)}
                </select></FG>
                <FG label="Localização (detalhe)"><input className="fi" value={form.location||''} onChange={e=>setForm(f=>({...f,location:e.target.value}))} placeholder="Ex: Sala 2"/></FG>
              </div>
              <div className="form-row">
                <FG label="Status"><select className="fi" value={form.status||''} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  <option value="">— Selecione —</option>
                  {statuses.map(s=><option key={s.id}>{s.name}</option>)}
                </select></FG>
                <FG label="Data de Aquisição"><input className="fi" type="date" value={form.acquisition_date||''} onChange={e=>setForm(f=>({...f,acquisition_date:e.target.value}))}/></FG>
              </div>
              <FG label="Observações"><textarea className="fi" rows="3" value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Informações adicionais..."/></FG>
              <ModalActions onCancel={()=>setModal(null)} onSave={saveEquipment}/>
            </>}

            {/* Ordem de Serviço */}
            {modal==='order' && <>
              <h2>{form.id ? '✏️ Editar OS' : '🔧 Nova Ordem de Serviço'}</h2>
              {!equipment.length && (
                <div style={{background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:'10px',padding:'14px',marginBottom:'16px',fontSize:'13px',color:'#fca5a5'}}>
                  ⚠️ <strong>Nenhum equipamento cadastrado.</strong> Cadastre o equipamento primeiro em <strong>Inventário → ➕ Novo Equipamento</strong> para criar uma OS e registrar o histórico de reparos.
                </div>
              )}
              <div className="form-row">
                <FG label="Equipamento (obrigatório cadastrar para histórico)">
                  <select className="fi" value={form.equip_id||''} onChange={e=>setForm(f=>({...f,equip_id:e.target.value}))}>
                    <option value="">— Selecione o equipamento —</option>
                    {equipment.map(e=><option key={e.id} value={e.id}>{e.brand} {e.model} · Série: {e.serial} · Unidade: {e.unit||'—'}</option>)}
                  </select>
                </FG>
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
            {modal==='logistic' && <LogisticModal
              form={form} setForm={setForm} equipment={equipment} eqFull={eqFull}
              SERIAL_COLORS={SERIAL_COLORS}
              onCancel={()=>setModal(null)} onSave={saveLogistic}
            />}

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

            {modal==='newStatus' && <>
              <h2>🔵 Novo Status</h2>
              <FG label="Nome do Status"><input className="fi" placeholder="Ex: Operando 100%" value={form.name||''} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></FG>
              <FG label="Cor (hex)">
                <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                  <input type="color" value={form.color||'#10b981'} onChange={e=>setForm(f=>({...f,color:e.target.value}))} style={{width:'48px',height:'36px',border:'1px solid #e2e8f0',borderRadius:'6px',cursor:'pointer'}}/>
                  <input className="fi" placeholder="#10b981" value={form.color||'#10b981'} onChange={e=>setForm(f=>({...f,color:e.target.value}))} style={{flex:1}}/>
                </div>
              </FG>
              <ModalActions onCancel={()=>setModal(null)} onSave={async()=>{
                if(!form.name?.trim()){showToast('Digite o nome do status.',true);return}
                await db.statuses.insert({name:form.name.trim(),color:form.color||'#10b981'})
                setModal(null); reload(); showToast('Status criado!')
              }}/>
            </>}

            {modal==='newType' && <>
              <h2>🏷️ Novo Tipo de Equipamento</h2>
              <FG label="Nome do Tipo"><input className="fi" placeholder="Ex: Laser Quanta" value={form.name||''} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></FG>
              <ModalActions onCancel={()=>setModal(null)} onSave={async()=>{
                if(!form.name?.trim()){showToast('Digite o nome do tipo.',true);return}
                await db.equipment_types.insert({name:form.name.trim()})
                setModal(null); reload(); showToast('Tipo criado!')
              }}/>
            </>}

            {modal==='newUnit' && <>
              <h2>🏢 Nova Unidade</h2>
              <FG label="Nome da Unidade"><input className="fi" placeholder="Ex: Matriz São Paulo" value={form.name||''} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></FG>
              <FG label="Status inicial">
                <select className="fi" value={form.active===false?'false':'true'} onChange={e=>setForm(f=>({...f,active:e.target.value==='true'}))}>
                  <option value="true">✅ Ativa</option>
                  <option value="false">❌ Inativa</option>
                </select>
              </FG>
              <ModalActions onCancel={()=>setModal(null)} onSave={async()=>{
                if(!form.name?.trim()){showToast('Digite o nome da unidade.',true);return}
                await db.units.insert({name:form.name.trim(),active:form.active!==false})
                setModal(null); reload(); showToast('Unidade criada!')
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

const LOJAS = ['Butantã','Campo Limpo','Frei Caneca','Loja Conceito','Metro Tatuapé','Metro Tucuruvi','West Plaza','Moema','Osasco','Treinamento']

function LogisticModal({ form, setForm, equipment, eqFull, SERIAL_COLORS, onCancel, onSave }) {
  const selSerial = form.serial || eqFull[form.equip_id]?.serial || ''
  const cor = selSerial ? (SERIAL_COLORS[selSerial] || '#6366f1') : '#6366f1'
  return <>
    <h2>{form.id ? '✏️ Editar Evento' : '📅 Novo Evento de Transporte'}</h2>
    {selSerial && <div style={{background:cor+'18',border:`1px solid ${cor}44`,borderRadius:'8px',padding:'8px 14px',marginBottom:'14px',fontSize:'13px',fontWeight:'700',color:cor}}>● Série: {selSerial}</div>}
    <div className="form-row">
      <FG label="Data"><input className="fi" type="date" value={form.event_date||''} onChange={e=>setForm(f=>({...f,event_date:e.target.value}))}/></FG>
      <FG label="Tipo"><select className="fi" value={form.log_type||'Entrega'} onChange={e=>setForm(f=>({...f,log_type:e.target.value}))}>
        {['Entrega','Retirada','Manutenção','Instalação','Treinamento'].map(t=><option key={t}>{t}</option>)}
      </select></FG>
    </div>
    <div className="form-row">
      <FG label="Equipamento">
        <select className="fi" value={form.equip_id||''} onChange={e=>{
          const eq = eqFull[e.target.value]
          setForm(f=>({...f, equip_id:e.target.value, serial:eq?.serial||f.serial}))
        }}>
          <option value="">— Nenhum —</option>
          {equipment.map(e=><option key={e.id} value={e.id}>{e.brand} {e.model} · {e.serial}</option>)}
        </select>
      </FG>
      <FG label="Nº de Série"><input className="fi" value={form.serial||''} onChange={e=>setForm(f=>({...f,serial:e.target.value}))} placeholder="Ex: UQIA24043"/></FG>
    </div>
    <FG label="Loja de Destino / Origem">
      <select className="fi" value={form.store||''} onChange={e=>setForm(f=>({...f,store:e.target.value}))}>
        <option value="">— Selecione a loja —</option>
        {LOJAS.map(l=><option key={l}>{l}</option>)}
      </select>
    </FG>
    <FG label="Descrição"><textarea className="fi" rows="2" value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Detalhes do evento..."/></FG>
    <ModalActions onCancel={onCancel} onSave={onSave}/>
  </>
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
