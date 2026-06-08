'use client'

export default function AcessoPage() {
  function copyUrl() {
    navigator.clipboard.writeText('https://equipcare-pro.vercel.app').then(() => {
      const btn = document.getElementById('copybtn')
      if (btn) { btn.textContent = '✅ Copiado!'; btn.style.background = '#10b981' }
      setTimeout(() => {
        if (btn) { btn.textContent = '📋 Copiar Link'; btn.style.background = '#6366f1' }
      }, 2000)
    })
  }

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:system-ui,-apple-system,sans-serif}
        .pg{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
          background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)}
        .card{background:#1e293b;border:1px solid #334155;border-radius:24px;padding:40px;
          max-width:500px;width:100%;box-shadow:0 25px 60px rgba(0,0,0,.6);color:#f1f5f9}
        .header{text-align:center;margin-bottom:28px}
        .logo{font-size:56px;margin-bottom:10px}
        h1{font-size:26px;font-weight:800;color:#a5b4fc;margin-bottom:4px}
        .sub{color:#64748b;font-size:13px;line-height:1.5}
        .online{display:inline-flex;align-items:center;gap:6px;background:rgba(16,185,129,.15);
          color:#10b981;padding:5px 14px;border-radius:999px;font-size:12px;font-weight:700;margin-top:12px}
        .url-box{background:#0f172a;border:1px solid #334155;border-radius:14px;
          padding:18px 20px;text-align:center;margin-bottom:24px}
        .url-label{font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;
          letter-spacing:1px;margin-bottom:6px}
        .url-text{font-size:17px;font-weight:800;color:#a5b4fc;margin-bottom:14px}
        .btns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
        .btn-copy{background:#6366f1;color:#fff;border:none;border-radius:8px;
          padding:10px 22px;font-size:13px;font-weight:700;cursor:pointer}
        .btn-open{background:transparent;color:#a5b4fc;border:1px solid #4f46e5;border-radius:8px;
          padding:10px 18px;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block}
        .qr{text-align:center;margin-bottom:24px}
        .qr-label{font-size:12px;color:#64748b;margin-bottom:10px;font-weight:600}
        .qr-img{border-radius:14px;background:#fff;padding:14px;display:inline-block}
        hr{border:none;border-top:1px solid #334155;margin:20px 0}
        .sec{font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;
          letter-spacing:1px;margin-bottom:14px}
        .step{display:flex;align-items:flex-start;gap:12px;margin-bottom:10px;
          background:#0f172a;border-radius:10px;padding:14px}
        .step-i{font-size:22px;flex-shrink:0;margin-top:2px}
        .step-t{font-size:13px;color:#94a3b8;line-height:1.55}
        .step-t strong{color:#f1f5f9}
        .info{background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.25);
          border-radius:12px;padding:16px;margin-bottom:14px}
        .info-t{font-size:12px;font-weight:700;color:#a5b4fc;margin-bottom:8px}
        .info-g{background:rgba(16,185,129,.06);border-color:rgba(16,185,129,.2)}
        .info-gt{color:#10b981}
        .info-x{font-size:13px;color:#94a3b8;line-height:1.6}
        .info-x strong{color:#f1f5f9}
        .footer{text-align:center;color:#475569;font-size:11px;margin-top:8px}
        .btn-print{background:none;border:1px solid #334155;border-radius:8px;
          padding:8px 18px;color:#64748b;cursor:pointer;font-size:12px;margin-top:12px}
        @media(max-width:480px){.card{padding:28px 20px}.url-text{font-size:14px}}
        @media print{
          .pg{background:#fff}.card{box-shadow:none;border:2px solid #e2e8f0;background:#fff;color:#1e293b;max-width:100%}
          h1,.url-text,.sec,.info-t{color:#1e293b}.sub,.step-t,.info-x,.footer,.url-label,.qr-label{color:#475569}
          .step-t strong,.info-x strong{color:#1e293b}.url-box,.step,.info,.info-g{background:#f8fafc;border-color:#e2e8f0}
          .online,.btn-copy,.btn-open,.btn-print{display:none}.qr-img{box-shadow:none}
        }
      `}</style>

      <div className="pg">
        <div className="card">
          <div className="header">
            <div className="logo">⚙️</div>
            <h1>EquipCare Pro</h1>
            <p className="sub">Sistema de Gestão de Máquinas e Equipamentos<br/>Laser&amp;Co</p>
            <div className="online">● Sistema Online</div>
          </div>

          <div className="url-box">
            <div className="url-label">🔗 Endereço do Sistema</div>
            <div className="url-text">equipcare-pro.vercel.app</div>
            <div className="btns">
              <button id="copybtn" className="btn-copy" onClick={copyUrl}>📋 Copiar Link</button>
              <a className="btn-open" href="https://equipcare-pro.vercel.app" target="_blank" rel="noreferrer">🚀 Abrir Sistema</a>
            </div>
          </div>

          <div className="qr">
            <div className="qr-label">📱 Escaneie para acessar no celular</div>
            <div className="qr-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://api.qrserver.com/v1/create-qr-code/?data=https://equipcare-pro.vercel.app&size=180x180&color=1e293b&bgcolor=ffffff&qzone=1&margin=0"
                alt="QR Code EquipCare Pro" width="180" height="180"
              />
            </div>
          </div>

          <hr/>

          <div>
            <div className="sec">📲 Como instalar como App</div>
            <div className="step">
              <div className="step-i">🍎</div>
              <div className="step-t">
                <strong>iPhone / iPad</strong><br/>
                Abra no <strong>Safari</strong> → toque em Compartilhar <strong>↑</strong> → <strong>&quot;Adicionar à Tela de Início&quot;</strong> → Adicionar
              </div>
            </div>
            <div className="step">
              <div className="step-i">🤖</div>
              <div className="step-t">
                <strong>Android</strong><br/>
                Abra no <strong>Chrome</strong> → toque em <strong>⋮</strong> → <strong>&quot;Adicionar à tela inicial&quot;</strong> → Adicionar
              </div>
            </div>
            <div className="step">
              <div className="step-i">💻</div>
              <div className="step-t">
                <strong>Computador (Chrome ou Edge)</strong><br/>
                Abra o sistema → clique no ícone <strong>⊕</strong> na barra de endereço → <strong>Instalar</strong>
              </div>
            </div>
          </div>

          <hr/>

          <div className="info">
            <div className="info-t">✉️ Primeiro Acesso</div>
            <div className="info-x">
              O administrador envia um <strong>convite por e-mail</strong> pelo sistema.<br/>
              Clique em <strong>&quot;Ativar Meu Acesso&quot;</strong>, crie sua senha e o sistema estará disponível em todos os dispositivos!
            </div>
          </div>

          <div className={`info info-g`}>
            <div className={`info-t info-gt`}>🔐 Segurança</div>
            <div className="info-x">
              Cada usuário tem <strong>login e senha individuais</strong>. Dados em nuvem com <strong>auditoria automática</strong> de todas as ações.
            </div>
          </div>

          <hr/>
          <div className="footer">
            EquipCare Pro v2.0 &bull; Laser&amp;Co &bull; 2025<br/>
            <button className="btn-print" onClick={() => window.print()}>🖨️ Imprimir / Salvar PDF</button>
          </div>
        </div>
      </div>
    </>
  )
}
