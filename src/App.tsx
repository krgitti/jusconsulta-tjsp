import { useMemo, useState, useEffect } from 'react';
import {
  buscarProcessos,
  buscarDetalhesProcesso,
  buscarDetalhesProcessoPorUrl,
  gerarUrlBuscaEsaj,
  gerarUrlsBuscaOficial,
  TipoBusca,
  ResultadoBusca,
  ModoConsulta,
} from './services/tjspService';
import { ProcessoTJSP } from './types/processo';
import ProcessoView from './components/ProcessoView';
import MonitorPanel from './components/MonitorPanel';
import { setupPushListeners } from './services/monitorService';

type TabBusca = 'numero' | 'nome' | 'documento';
type FiltroInstancia = 'todas' | string;

function App() {
  const [tabAtiva, setTabAtiva] = useState<TabBusca>('nome');

  // Configurar listeners de push notification (nativo)
  useEffect(() => { setupPushListeners(); }, []);
  const [termoBusca, setTermoBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proxyError, setProxyError] = useState(false);
  const [urlFallback, setUrlFallback] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const [processoSelecionado, setProcessoSelecionado] = useState<ProcessoTJSP | null>(null);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [filtroInstancia, setFiltroInstancia] = useState<FiltroInstancia>('todas');
  const [modoConsulta, setModoConsulta] = useState<ModoConsulta>('rapida');

  const getTipoBusca = (): TipoBusca => {
    if (tabAtiva === 'numero') return 'NUMPROC';
    if (tabAtiva === 'documento') return 'DOCPARTE';
    return 'NMPARTE';
  };

  const getPlaceholder = () => {
    if (tabAtiva === 'numero') return 'Ex: 1007738-42.2024.8.26.0564';
    if (tabAtiva === 'documento') return 'Digite o CPF ou CNPJ';
    return 'Digite o nome da parte';
  };

  const linksOficiaisFallback = useMemo(() => {
    const termo = termoBusca.trim();
    if (!termo) return [];
    return gerarUrlsBuscaOficial(termo, getTipoBusca());
  }, [termoBusca, tabAtiva]);

  const instanciasDisponiveis = useMemo(() => {
    return Array.from(new Set(resultados.map((r) => r.instancia))).filter(Boolean);
  }, [resultados]);

  const resultadosFiltrados = useMemo(() => {
    if (filtroInstancia === 'todas') return resultados;
    return resultados.filter((r) => r.instancia === filtroInstancia);
  }, [resultados, filtroInstancia]);

  const carregarDetalhes = async (resultado: ResultadoBusca) => {
    setLoadingDetalhes(true);
    setError(null);
    setProxyError(false);
    setUrlFallback(null);

    try {
      const processo = await buscarDetalhesProcesso(
        resultado.codigo,
        resultado.foro,
        resultado.numero,
        resultado.sistema,
        resultado.urlDireta,
      );

      if (!processo) {
        setError('Não foi possível carregar os detalhes do processo selecionado.');
        setUrlFallback(resultado.urlDireta || gerarUrlBuscaEsaj(resultado.numero, 'NUMPROC'));
        return;
      }

      setProcessoSelecionado(processo);
      setMostrarResultados(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      if (msg.startsWith('PROXY_FAILED:')) {
        setProxyError(true);
        setError('Não foi possível carregar os detalhes agora. A conexão pública foi bloqueada ou expirou.');
      } else {
        setError(`Erro ao carregar detalhes: ${msg}`);
      }
      setUrlFallback(resultado.urlDireta || gerarUrlBuscaEsaj(resultado.numero, 'NUMPROC'));
    } finally {
      setLoadingDetalhes(false);
    }
  };

  const handleBuscar = async () => {
    const termo = termoBusca.trim();
    const tipo = getTipoBusca();
    if (!termo) {
      setError('Por favor, digite um termo de busca.');
      return;
    }

    setLoading(true);
    setLoadingDetalhes(false);
    setError(null);
    setProxyError(false);
    setUrlFallback(null);
    setResultados([]);
    setProcessoSelecionado(null);
    setMostrarResultados(false);
    setFiltroInstancia('todas');

    try {
      const lista = await buscarProcessos(termo, tipo, tipo === 'NUMPROC' ? 'rapida' : modoConsulta);
      if (lista.length === 0) {
        setError('Nenhum processo foi retornado pela consulta pública no momento. Isso pode significar ausência de resultados ou bloqueio/limitação temporária dos sistemas acessados pelo navegador.');
        setUrlFallback(gerarUrlBuscaEsaj(termo, tipo));
        return;
      }

      setResultados(lista);
      setMostrarResultados(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      if (msg.startsWith('PROXY_FAILED:')) {
        setProxyError(true);
        setError('A consulta pública demorou demais ou foi bloqueada pelos proxies disponíveis. Tente novamente ou refine o termo pesquisado.');
      } else {
        setError(msg);
      }
      setUrlFallback(gerarUrlBuscaEsaj(termo, tipo));
    } finally {
      setLoading(false);
    }
  };

  const handleBuscarProcessoRelacionado = async (numero: string, url?: string) => {
    setLoadingDetalhes(true);
    setError(null);
    setProxyError(false);
    setUrlFallback(null);

    try {
      let processo: ProcessoTJSP | null = null;
      if (url) {
        processo = await buscarDetalhesProcessoPorUrl(url);
      }
      if (!processo) {
        const encontrados = await buscarProcessos(numero, 'NUMPROC');
        const primeiro = encontrados[0];
        if (primeiro) {
          processo = await buscarDetalhesProcesso(
            primeiro.codigo,
            primeiro.foro,
            primeiro.numero,
            primeiro.sistema,
            primeiro.urlDireta,
          );
        }
      }

      if (!processo) {
        setError('Não foi possível abrir o processo relacionado.');
        setUrlFallback(url || gerarUrlBuscaEsaj(numero, 'NUMPROC'));
        return;
      }

      setProcessoSelecionado(processo);
      setMostrarResultados(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      if (msg.startsWith('PROXY_FAILED:')) {
        setProxyError(true);
        setError('Não foi possível acessar o processo relacionado no momento. A conexão pública expirou ou foi bloqueada.');
      } else {
        setError(`Erro ao abrir relacionado: ${msg}`);
      }
      setUrlFallback(url || gerarUrlBuscaEsaj(numero, 'NUMPROC'));
    } finally {
      setLoadingDetalhes(false);
    }
  };

  const limparBusca = () => {
    setTermoBusca('');
    setResultados([]);
    setProcessoSelecionado(null);
    setMostrarResultados(false);
    setError(null);
    setProxyError(false);
    setUrlFallback(null);
    setFiltroInstancia('todas');
  };

  const voltarParaResultados = () => {
    setProcessoSelecionado(null);
    setMostrarResultados(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col">
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <button onClick={limparBusca} className="flex items-center gap-3 text-left">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
              ⚖️
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold">JusConsulta TJSP</h1>
              <p className="text-xs text-slate-400">Consulta por nome, CPF/CNPJ e nº do processo</p>
            </div>
          </button>

          <a
            href="https://esaj.tjsp.jus.br/cpopg/open.do"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-amber-400 hover:text-amber-300"
          >
            e-SAJ oficial ↗
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full px-4 py-6 flex-1">
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-6 mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">Consulta ampliada</h2>
              <p className="text-sm text-slate-400 mt-1">
                Busca otimizada nos sistemas públicos principais do TJSP: 1º grau, 2º grau e Colégio Recursal, com foco em mais estabilidade e menos erros de conexão.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
              {[
                { id: 'nome' as TabBusca, label: 'Nome da parte', short: 'Nome', icon: '👤' },
                { id: 'documento' as TabBusca, label: 'CPF / CNPJ', short: 'CPF/CNPJ', icon: '🪪' },
                { id: 'numero' as TabBusca, label: 'Nº processo', short: 'Número', icon: '📋' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTabAtiva(tab.id)}
                  className={`rounded-xl px-3 py-2.5 text-sm font-medium border transition-colors ${
                    tabAtiva === tab.id
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <span className="sm:hidden">{tab.icon} {tab.short}</span>
                  <span className="hidden sm:inline">{tab.icon} {tab.label}</span>
                </button>
              ))}
            </div>

            {tabAtiva !== 'numero' && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setModoConsulta('rapida')}
                  className={`rounded-xl px-3 py-2 text-sm font-medium border ${
                    modoConsulta === 'rapida'
                      ? 'bg-emerald-500 text-white border-emerald-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  Busca rápida
                </button>
                <button
                  onClick={() => setModoConsulta('completa')}
                  className={`rounded-xl px-3 py-2 text-sm font-medium border ${
                    modoConsulta === 'completa'
                      ? 'bg-sky-500 text-white border-sky-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  Busca completa
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleBuscar()}
                placeholder={getPlaceholder()}
                className="flex-1 rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                onClick={handleBuscar}
                disabled={loading || loadingDetalhes}
                className="rounded-xl px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-semibold disabled:opacity-50"
              >
                {loading ? (tabAtiva === 'numero' ? 'Buscando...' : `Buscando (${modoConsulta})...`) : 'Buscar'}
              </button>
            </div>
            <div className="text-xs text-slate-500 -mt-1">
              Dica: para nome e CPF/CNPJ, use <strong>Busca rápida</strong> para mais estabilidade ou <strong>Busca completa</strong> para tentar encontrar mais processos, com maior tempo de consulta.
            </div>

            {!processoSelecionado && !mostrarResultados && !loading && !error && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <div className="text-amber-400 font-semibold mb-1">1º Grau</div>
                    <p className="text-slate-400">Consulta processual pública principal do TJSP.</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <div className="text-blue-400 font-semibold mb-1">2º Grau</div>
                    <p className="text-slate-400">Recursos, apelações e tramitações em grau superior.</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <div className="text-fuchsia-400 font-semibold mb-1">Colégio Recursal</div>
                    <p className="text-slate-400">Turmas recursais e uniformização quando houver consulta pública.</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <div className="text-emerald-400 font-semibold mb-1">Julgados</div>
                    <p className="text-slate-400">Bases auxiliares do e-SAJ quando disponíveis ao público.</p>
                  </div>
                </div>
            )}
          </div>
        </section>

        {error && (
          <div className={`mb-6 rounded-2xl border p-4 ${proxyError ? 'border-amber-700 bg-amber-950/20' : 'border-red-800 bg-red-950/20'}`}>
            <div className="font-semibold mb-1">{proxyError ? 'Conexão indisponível' : 'Erro na consulta'}</div>
            <p className="text-sm text-slate-300">{error}</p>
            {urlFallback && (
              <a
                href={urlFallback}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex mt-3 rounded-lg bg-amber-500 text-slate-950 px-4 py-2 text-sm font-semibold"
              >
                Abrir no e-SAJ
              </a>
            )}

            {proxyError && linksOficiaisFallback.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-medium text-amber-300 mb-2">Tentar consulta oficial por sistema:</div>
                <div className="flex flex-wrap gap-2">
                  {linksOficiaisFallback.map((item) => (
                    <a
                      key={`${item.id}-${item.instancia}`}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-amber-700/60 bg-slate-950/40 px-3 py-2 text-xs sm:text-sm text-amber-100 hover:bg-slate-900"
                    >
                      {item.instancia} · {item.id.toUpperCase()}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {loadingDetalhes && (
          <div className="py-16 text-center">
            <div className="w-14 h-14 mx-auto rounded-full border-4 border-amber-500 border-t-transparent animate-spin mb-4"></div>
            <p className="text-slate-300">Carregando detalhes do processo...</p>
          </div>
        )}

        {mostrarResultados && !loading && !loadingDetalhes && (
          <section className="space-y-4">
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">
                    {resultados.length} processo{resultados.length !== 1 ? 's' : ''} encontrado{resultados.length !== 1 ? 's' : ''}
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Os resultados mostram a origem por instância/sistema. Se ainda faltar algum processo, abra a consulta oficial do e-SAJ pelo botão ao lado para conferir eventual limitação pública/proxy.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFiltroInstancia('todas')}
                    className={`px-3 py-2 rounded-lg text-sm border ${
                      filtroInstancia === 'todas'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    Todas ({resultados.length})
                  </button>
                  {instanciasDisponiveis.map((instancia) => {
                    const total = resultados.filter((r) => r.instancia === instancia).length;
                    return (
                      <button
                        key={instancia}
                        onClick={() => setFiltroInstancia(instancia)}
                        className={`px-3 py-2 rounded-lg text-sm border ${
                          filtroInstancia === instancia
                            ? 'bg-sky-500 text-white border-sky-400'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {instancia} ({total})
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {resultadosFiltrados.map((resultado, index) => (
                <article
                  key={`${resultado.sistema}-${resultado.numero}-${index}`}
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/20">
                          {resultado.instancia}
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {resultado.origemLabel}
                        </span>
                      </div>
                      <h4 className="font-mono text-base sm:text-lg text-amber-400 break-all">{resultado.numero}</h4>
                      {resultado.classe && <p className="text-slate-200 mt-1">{resultado.classe}</p>}
                      {resultado.assunto && <p className="text-sm text-slate-400 mt-1">{resultado.assunto}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-4">
                    {resultado.foro_nome && <InfoMini label="Foro" value={resultado.foro_nome} />}
                    {resultado.vara && <InfoMini label="Vara" value={resultado.vara} />}
                    {resultado.dataDistribuicao && <InfoMini label="Distribuição" value={resultado.dataDistribuicao} />}
                    {resultado.sistema && <InfoMini label="Sistema" value={resultado.sistema.toUpperCase()} />}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => carregarDetalhes(resultado)}
                      className="flex-1 rounded-xl bg-amber-500 text-slate-950 font-semibold px-4 py-2.5 hover:bg-amber-400"
                    >
                      Ver dados deste processo
                    </button>
                    <a
                      href={resultado.urlDireta || gerarUrlBuscaEsaj(resultado.numero, 'NUMPROC')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl bg-slate-800 border border-slate-700 text-slate-200 px-4 py-2.5 text-center hover:bg-slate-700"
                    >
                      Abrir no e-SAJ
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {processoSelecionado && !loadingDetalhes && (
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  onClick={voltarParaResultados}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  ← Voltar aos resultados
                </button>
                {processoSelecionado.instancia && (
                  <span className="px-3 py-1 rounded-full text-xs bg-amber-500/15 text-amber-300 border border-amber-500/20">
                    {processoSelecionado.instancia}
                  </span>
                )}
                {processoSelecionado.sistema && (
                  <span className="px-3 py-1 rounded-full text-xs bg-slate-800 text-slate-300 border border-slate-700">
                    {processoSelecionado.sistema.toUpperCase()}
                  </span>
                )}
              </div>
              <button
                onClick={limparBusca}
                className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Nova consulta
              </button>
            </div>

            <ProcessoView processo={processoSelecionado} onBuscarProcesso={handleBuscarProcessoRelacionado} />
          </section>
        )}

        {!loading && !loadingDetalhes && !error && !mostrarResultados && !processoSelecionado && (
          <section className="py-8 sm:py-14 text-center">
            <div className="w-24 h-24 mx-auto rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-4xl mb-6">
              📚
            </div>
            <h3 className="text-2xl font-bold mb-2">Consulta processual ampliada</h3>
            <p className="max-w-2xl mx-auto text-slate-400">
              Pesquise por nome, documento ou número do processo. Quando houver vários resultados, você escolhe exatamente qual processo abrir.
            </p>
          </section>
        )}
      </main>

      <footer className="border-t border-slate-900 py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500">
          Consulta não-oficial baseada em páginas públicas do e-SAJ TJSP. Alguns resultados podem depender da disponibilidade dos proxies e das estruturas públicas do tribunal.
        </div>
      </footer>
      <MonitorPanel />
    </div>
  );
}

function InfoMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-slate-200 mt-0.5 break-words">{value}</div>
    </div>
  );
}

export default App;
