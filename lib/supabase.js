import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://riutcbwillvqjrpaefkb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpdXRjYndpbGx2cWpycGFlZmtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NDk0MzksImV4cCI6MjA5MDMyNTQzOX0.WR69xD-_dvkG7dN2EkwerPw0Su8vcStNgnha8Ky0grA'

// Lazy singleton - only instantiated at runtime, never during SSR build
let _client = null

export function getClient() {
  if (!_client) _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return _client
}

// Auth helpers
export const signIn = (email, password) =>
  getClient().auth.signInWithPassword({ email, password })

export const signOut = () => getClient().auth.signOut()

export const getSession = async () => {
  const { data } = await getClient().auth.getSession()
  return data.session
}

// DB helpers
export const db = {
  equipment: {
    getAll: () => getClient().from('equipment').select('*').order('created_at', { ascending: false }),
    insert: (data) => getClient().from('equipment').insert(data).select().single(),
    update: (id, data) => getClient().from('equipment').update(data).eq('id', id).select().single(),
    delete: (id) => getClient().from('equipment').delete().eq('id', id),
  },
  orders: {
    getAll: () => getClient().from('orders').select('*, equipment(brand,model,serial)').order('created_at', { ascending: false }),
    insert: (data) => getClient().from('orders').insert(data).select().single(),
    update: (id, data) => getClient().from('orders').update(data).eq('id', id).select().single(),
    delete: (id) => getClient().from('orders').delete().eq('id', id),
  },
  stops: {
    getAll: () => getClient().from('stops').select('*, equipment(brand,model)').order('start_date'),
    insert: (data) => getClient().from('stops').insert(data).select().single(),
    delete: (id) => getClient().from('stops').delete().eq('id', id),
  },
  logistics: {
    getAll: () => getClient().from('logistics').select('*, equipment(brand,model)').order('event_date', { ascending: false }),
    insert: (data) => getClient().from('logistics').insert(data).select().single(),
    delete: (id) => getClient().from('logistics').delete().eq('id', id),
  },
  vendors: {
    getAll: () => getClient().from('vendors').select('*').order('company'),
    insert: (data) => getClient().from('vendors').insert(data).select().single(),
    update: (id, data) => getClient().from('vendors').update(data).eq('id', id).select().single(),
    delete: (id) => getClient().from('vendors').delete().eq('id', id),
  },
  expenses: {
    getAll: () => getClient().from('expenses').select('*, equipment(brand,model)').order('expense_date', { ascending: false }),
    insert: (data) => getClient().from('expenses').insert(data).select().single(),
    delete: (id) => getClient().from('expenses').delete().eq('id', id),
  },
  audit: {
    getAll: () => getClient().from('audit_log').select('*').order('created_at', { ascending: false }).limit(200),
    insert: (data) => getClient().from('audit_log').insert(data),
  },
  profiles: {
    getAll: () => getClient().from('profiles').select('*').order('created_at'),
    update: (id, data) => getClient().from('profiles').update(data).eq('id', id),
    getOne: (id) => getClient().from('profiles').select('*').eq('id', id).single(),
  },
  units: {
    getAll: () => getClient().from('units').select('*').order('name'),
    insert: (data) => getClient().from('units').insert(data).select().single(),
    update: (id, data) => getClient().from('units').update(data).eq('id', id).select().single(),
    delete: (id) => getClient().from('units').delete().eq('id', id),
  },
  statuses: {
    getAll: () => getClient().from('statuses').select('*').order('name'),
    insert: (data) => getClient().from('statuses').insert(data).select().single(),
    delete: (id) => getClient().from('statuses').delete().eq('id', id),
  },
  equipment_types: {
    getAll: () => getClient().from('equipment_types').select('*').order('name'),
    insert: (data) => getClient().from('equipment_types').insert(data).select().single(),
    delete: (id) => getClient().from('equipment_types').delete().eq('id', id),
  },
}
