export default function manifest() {
  return {
    name: 'EquipCare Pro — Laser&Co',
    short_name: 'EquipCare',
    description: 'Sistema de Gestão de Máquinas e Equipamentos da Laser&Co',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#6366f1',
    orientation: 'portrait-primary',
    lang: 'pt-BR',
    icons: [
      { src: '/icons/icon-72.png',  sizes: '72x72',   type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/icon-96.png',  sizes: '96x96',   type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/icon-128.png', sizes: '128x128', type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/icon-144.png', sizes: '144x144', type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/icon-152.png', sizes: '152x152', type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/icon-384.png', sizes: '384x384', type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
    shortcuts: [
      { name: 'Dashboard',  url: '/dashboard' },
      { name: 'Inventário', url: '/dashboard' },
    ],
    categories: ['business', 'productivity'],
  }
}
