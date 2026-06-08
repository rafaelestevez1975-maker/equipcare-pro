export const metadata = {
  title: 'EquipCare Pro — Gestão de Equipamentos',
  description: 'Sistema profissional de gestão de máquinas e equipamentos',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, padding: 0, background: '#0f172a' }}>
        {children}
      </body>
    </html>
  )
}
