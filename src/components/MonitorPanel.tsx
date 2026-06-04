import { useState, useEffect, useCallback } from 'react';

// Gist público de leitura — token não necessário para leitura se o gist for público
// Como o gist é privado, usamos o token apenas para leitura (read:gist)
const GIST_ID    = import.meta.env.VITE_GIST_ID    || '2ef280e3330c2e01fc4144a47fb6e8a5';
const GIST_TOKEN = import.meta.env.VITE_GIST_TOKEN || '';

interface Movimentacao { data: string; titulo: string; }
interface ProcessoEstado {
  movs: Movimentacao[];
  atualizado: string;
  ignorado?: boolean;
}
interface GistState { [numero: string]: ProcessoEstado; }

function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  const h    = Math.floor(min / 60);
  const d    = Math.floor(h / 24);
  if (d > 0)  return `há ${d} dia${d > 1 ? 's' : ''}`;
  if (h > 0)  return `há ${h}h`;
  if (min > 0) return `há ${min}min`;
  return 'agora mesmo';
}

export default function MonitorPanel() {
  const [aberto,    setAberto]    = useState(false);
  const [estado,    setEstado]    = useState<GistState | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [erro,      setErro]      = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null);
    try {
      const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
      if (GIST_TOKEN) headers['Authorization'] = `token ${GIST_TOKEN}`;
      const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, { headers });
      if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
      const data = await res.json();
      const content = data.files?.['monitor-state.json']?.content;
      if (!content) throw new Error('Arquivo de estado não encontrado no Gist');
      setEstado(JSON.parse(content));
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (aberto) carregar(); }, [aberto]);

  const processos = estado
    ? Object.entries(estado).sort((a, b) => {
        // ativos primeiro, depois por data de atualização
        if (!a[1].ignorado && b[1].ignorado) return -1;
        if (a[1].ignorado && !b[1].ignorado) return 1;
        return new Date(b[1].atualizado).getTime() - new Date(a[1].atualizado).getTime();
      })
    : [];

  const ativos   = processos.filter(([, v]) => !v.ignorado);
  const ignorados = processos.filter(([, v]) => v.ignorado);

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setAberto(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-xl shadow-amber-500/30 flex items-center justify-center text-2xl hover:scale-110 transition-transform"
        title="Processos monitorados"
      >
        🔔
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔔</span>
                <div>
                  <h2 className="font-bold text-white text-sm">Processos Monitorados</h2>
                  <p className="text-xs text-slate-500">Verificado 3× ao dia automaticamente</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={carregar}
                  disabled={loading}
                  className="text-slate-400 hover:text-amber-400 text-lg disabled:opacity-40 transition-colors"
                  title="Atualizar"
                >
                  {loading ? '⏳' : '🔄'}
                </button>
                <button onClick={() => setAberto(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-3">

              {loading && !estado && (
                <div className="py-12 text-center">
                  <div className="w-10 h-10 mx-auto rounded-full border-4 border-amber-500 border-t-transparent animate-spin mb-3" />
                  <p className="text-slate-400 text-sm">Carregando estado do monitor...</p>
                </div>
              )}

              {erro && (
                <div className="rounded-xl bg-red-900/30 border border-red-700 p-4 text-sm text-red-300">
                  {erro}
                </div>
              )}

              {/* Processos ativos */}
              {ativos.map(([numero, val]) => {
                const ultima = val.movs[0];
                const isExp  = expandido === numero;
                return (
                  <div key={numero} className="rounded-xl border border-slate-700 bg-slate-800/60 overflow-hidden">
                    {/* Cabeçalho do processo */}
                    <button
                      className="w-full text-left p-4"
                      onClick={() => setExpandido(isExp ? null : numero)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse" />
                            <span className="text-xs font-semibold text-emerald-400">Monitorando</span>
                            {val.atualizado && (
                              <span className="text-xs text-slate-500">
                                · verificado {tempoRelativo(val.atualizado)}
                              </span>
                            )}
                          </div>
                          <p className="font-mono text-amber-400 text-sm font-semibold">{numero}</p>
                          {ultima && (
                            <p className="text-xs text-slate-400 mt-1 truncate">
                              <span className="text-slate-500">{ultima.data}</span>
                              {' — '}
                              {ultima.titulo}
                            </p>
                          )}
                        </div>
                        <span className="text-slate-500 text-xs flex-shrink-0 mt-1">
                          {val.movs.length} mov. {isExp ? '▲' : '▼'}
                        </span>
                      </div>
                    </button>

                    {/* Movimentações expandidas */}
                    {isExp && (
                      <div className="border-t border-slate-700/60">
                        <div className="px-4 py-2 bg-slate-900/40">
                          <p className="text-xs text-slate-500 uppercase tracking-wider">
                            Últimas movimentações
                          </p>
                        </div>
                        <div className="divide-y divide-slate-700/40 max-h-64 overflow-y-auto">
                          {val.movs.slice(0, 15).map((m, i) => (
                            <div key={i} className="px-4 py-2.5 flex gap-3">
                              <span className="text-xs text-slate-500 font-mono whitespace-nowrap flex-shrink-0 mt-0.5">
                                {m.data}
                              </span>
                              <span className="text-xs text-slate-300 leading-relaxed">{m.titulo}</span>
                            </div>
                          ))}
                          {val.movs.length > 15 && (
                            <div className="px-4 py-2 text-xs text-slate-500 text-center">
                              + {val.movs.length - 15} movimentações anteriores
                            </div>
                          )}
                        </div>
                        <div className="px-4 py-3 border-t border-slate-700/60">
                          <a
                            href={`https://esaj.tjsp.jus.br/cpopg/search.do?cbPesquisa=NUMPROC&dePesquisaNuUnificado=${encodeURIComponent(numero)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-amber-400 hover:text-amber-300"
                          >
                            Abrir no e-SAJ ↗
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Processos ignorados (colapsados) */}
              {ignorados.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-600 uppercase tracking-wider px-1">Arquivados (sem monitoramento)</p>
                  {ignorados.map(([numero, val]) => (
                    <div key={numero} className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="font-mono text-slate-500 text-sm">{numero}</p>
                        {val.movs[0] && (
                          <p className="text-xs text-slate-600 mt-0.5 truncate max-w-xs">
                            {val.movs[0].data} — {val.movs[0].titulo}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-slate-600 ml-3 flex-shrink-0">⏭️</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Estado vazio */}
              {!loading && estado && processos.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="text-slate-400 text-sm">Nenhum processo no estado do monitor</p>
                </div>
              )}

              {/* Info */}
              {!loading && estado && (
                <div className="rounded-xl bg-slate-800/40 border border-slate-800 p-3 text-xs text-slate-500 space-y-1">
                  <p>📧 Alertas enviados para <span className="text-slate-400">krgitti80@gmail.com</span></p>
                  <p>⏰ Verificação automática: seg–sex 7h · 12h · 18h / sáb–dom 12h</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
