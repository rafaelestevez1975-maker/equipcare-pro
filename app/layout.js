export const metadata = {
  title: 'EquipCare Pro — Gestão de Equipamentos',
  description: 'Sistema profissional de gestão de máquinas e equipamentos',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'EquipCare Pro',
  },
  icons: {
    icon: [
      { url: '/icons/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export const viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="EquipCare Pro" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="msapplication-TileColor" content="#1e293b" />
        <meta name="msapplication-TileImage" content="/icons/icon-144.png" />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#ffffff', color: '#1e293b' }}>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js').catch(() => {})
            })
          }
        `}} />
      </body>
    </html>
  )
}
