import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://riutcbwillvqjrpaefkb.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpdXRjYndpbGx2cWpycGFlZmtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NDk0MzksImV4cCI6MjA5MDMyNTQzOX0.WR69xD-_dvkG7dN2EkwerPw0Su8vcStNgnha8Ky0grA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Auth helpers ──────────────────────────────────────────
export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser()
  return data.user
}

// Invite a new user (returns the invite link)
export async function inviteUser(email, name, role, unit) {
  const { data, error } = await supabase.auth.admin?.inviteUserByEmail(email, {
    data: { name, role, unit }
  })
  return { data, error }
}

// ── Profile helpers ───────────────────────────────────────
export async function getProfile(userId) {
  return supabase.from('profiles').select('*').eq('id', userId).single()
}

export async function getAllProfiles() {
  return supabase.from('profiles').select('*, auth_users:id(email)').order('created_at')
}

// ── Equipment ─────────────────────────────────────────────
export const db = {
  equipment: {
    getAll: () => supabase.from('equipment').select('*').order('created_at', { ascending: false }),
    insert: (data) => supabase.from('equipment').insert(data).select().single(),
    update: (id, data) => supabase.from('equipment').update(data).eq('id', id).select().single(),
    delete: (id) => supabase.from('equipment').delete().eq('id', id),
  },
  orders: {
    getAll: () => supabase.from('orders').select('*, equipment(brand,model,serial)').order('created_at', { ascending: false }),
    insert: (data) => supabase.from('orders').insert(data).select().single(),
    update: (id, data) => supabase.from('orders').update(data).eq('id', id).select().single(),
    delete: (id) => supabase.from('orders').delete().eq('id', id),
  },
  stops: {
    getAll: () => supabase.from('stops').select('*, equipment(brand,model)').order('start_date'),
    insert: (data) => supabase.from('stops').insert(data).select().single(),
    delete: (id) => supabase.from('stops').delete().eq('id', id),
  },
  logistics: {
    getAll: () => supabase.from('logistics').select('*, equipment(brand,model)').order('event_date', { ascending: false }),
    insert: (data) => supabase.from('logistics').insert(data).select().single(),
    delete: (id) => supabase.from('logistics').delete().eq('id', id),
  },
  vendors: {
    getAll: () => supabase.from('vendors').select('*').order('company'),
    insert: (data) => supabase.from('vendors').insert(data).select().single(),
    update: (id, data) => supabase.from('vendors').update(data).eq('id', id).select().single(),
    delete: (id) => supabase.from('vendors').delete().eq('id', id),
  },
  expenses: {
    getAll: () => supabase.from('expenses').select('*, equipment(brand,model)').order('expense_date', { ascending: false }),
    insert: (data) => supabase.from('expenses').insert(data).select().single(),
    delete: (id) => supabase.from('expenses').delete().eq('id', id),
  },
  audit: {
    getAll: () => supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200),
    insert: (data) => supabase.from('audit_log').insert(data),
  },
  profiles: {
    getAll: () => supabase.from('profiles').select('*').order('created_at'),
    update: (id, data) => supabase.from('profiles').update(data).eq('id', id),
  }
}
