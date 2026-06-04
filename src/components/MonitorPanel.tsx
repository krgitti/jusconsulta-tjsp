import { useState, useEffect } from 'react';
import { cadastrarMonitor, listarMonitor, removerMonitor, MonitorItem } from '../services/monitorService';

export default function MonitorPanel() {
  const [aberto, setAberto] = useState(false);
  const [email, setEmail] = useState('');
  const [valor, setValor] = useState('');
  const [tipo, setTipo] = useState<'cpf' | 'cnpj' | 'numero' | 'nome'>('cpf');
  const [label, setLabel] = useState('');
  const [items, setItems] = useState<MonitorItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [emailSalvo, setEmailSalvo] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('monitor_email');
    if (saved) { setEmail(saved); setEmailSalvo(saved); carregarLista(saved); }
  }, []);

  const carregarLista = async (em: string) => {
    if (!em) return;
    try {
      const lista = await listarMonitor(em);
      setItems(lista);
    } catch { /* silencioso */ }
  };

  const handleCadastrar = async () => {
    if (!email || !valor) { setMsg({ tipo: 'erro', texto: 'Preencha e-mail e o valor a monitorar.' }); return; }
    setLoading(true); setMsg(null);
    try {
      const { monitorados } = await cadastrarMonitor({ tipo, valor, label: label || undefined, email });
      setItems(monitorados);
      localStorage.setItem('monitor_email', email);
      setEmailSalvo(email);
      setValor(''); setLabel('');
      setMsg({ tipo: 'ok', texto: 'Monitoramento cadastrado! Você receberá e-mail e push ao detectar novidades.' });
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRemover = async (id: number) => {
    await removerMonitor(id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const tipoLabel: Record<string, string> = { cpf: 'CPF', cnpj: 'CNPJ', numero: 'Nº Processo', nome: 'Nome da parte' };

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setAberto(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-xl shadow-amber-500/30 flex items-center justify-center text-2xl hover:scale-110 transition-transform"
        title="Monitorar processo"
      >
        🔔
      </button>

      {!aberto ? null : (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/80">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔔</span>
                <h2 className="font-bold text-white">Monitorar processos</h2>
              </div>
              <button onClick={() => setAberto(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              {/* Formulário */}
              <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700 space-y-3">
                <p className="text-sm text-slate-400">
                  Cadastre um CPF, CNPJ ou número de processo. Você receberá <strong className="text-white">e-mail + push</strong> ao detectar novas movimentações.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {(['cpf','cnpj','numero','nome'] as const).map(t => (
                    <button key={t} onClick={() => setTipo(t)}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold border transition-colors ${tipo === t ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                      {tipoLabel[t]}
                    </button>
                  ))}
                </div>

                <input
                  type="text" value={valor} onChange={e => setValor(e.target.value)}
                  placeholder={tipo === 'cpf' ? '000.000.000-00' : tipo === 'cnpj' ? '00.000.000/0000-00' : tipo === 'numero' ? '0000000-00.0000.0.00.0000' : 'Nome da parte'}
                  className="w-full rounded-xl bg-slate-900 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
                <input
                  type="text" value={label} onChange={e => setLabel(e.target.value)}
                  placeholder="Descrição (opcional, ex: Meu processo trabalhista)"
                  className="w-full rounded-xl bg-slate-900 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com (para alertas)"
                  className="w-full rounded-xl bg-slate-900 border border-slate-600 px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />

                <button onClick={handleCadastrar} disabled={loading}
                  className="w-full rounded-xl bg-amber-500 text-slate-950 font-bold py-2.5 hover:bg-amber-400 disabled:opacity-50 text-sm">
                  {loading ? 'Cadastrando...' : '+ Ativar monitoramento'}
                </button>
              </div>

              {msg && (
                <div className={`rounded-xl p-3 text-sm border ${msg.tipo === 'ok' ? 'bg-emerald-900/30 border-emerald-700 text-emerald-300' : 'bg-red-900/30 border-red-700 text-red-300'}`}>
                  {msg.texto}
                </div>
              )}

              {/* Lista ativa */}
              {items.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Monitorando ativamente</p>
                  {items.map(item => (
                    <div key={item.id} className="flex items-center justify-between bg-slate-800/60 rounded-xl px-4 py-3 border border-slate-700">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                            {tipoLabel[item.tipo]}
                          </span>
                          {item.fcm_token && (
                            <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">📲 push</span>
                          )}
                        </div>
                        <p className="text-white text-sm font-mono mt-1 truncate">{item.valor}</p>
                        {item.label && <p className="text-slate-400 text-xs truncate">{item.label}</p>}
                      </div>
                      <button onClick={() => handleRemover(item.id)}
                        className="ml-3 text-slate-500 hover:text-red-400 text-lg flex-shrink-0">✕</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-xs text-slate-600 text-center">
                Verificação automática a cada 4 horas · Notificação push + e-mail
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
