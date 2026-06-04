import { useState } from 'react';
import { ProcessoTJSP, Movimentacao, Parte, Incidente } from '../types/processo';

interface ProcessoViewProps {
  processo: ProcessoTJSP;
  onBuscarProcesso?: (numero: string, url?: string) => void;
}

type TabType = 'detalhes' | 'movimentacoes' | 'partes' | 'documentos' | 'relacionados';

export default function ProcessoView({ processo, onBuscarProcesso }: ProcessoViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('detalhes');
  const [showAllMovimentacoes, setShowAllMovimentacoes] = useState(false);
  const [senhaProcesso, setSenhaProcesso] = useState('');
  const [tentandoAcessar, setTentandoAcessar] = useState(false);

  const temRelacionados = processo.processosRelacionados.length > 0 || processo.incidentes.length > 0;

  const tabs: { id: TabType; label: string; icon: string; count?: number }[] = [
    { id: 'detalhes', label: 'Detalhes', icon: '📋' },
    { id: 'movimentacoes', label: 'Movimentações', icon: '📜', count: processo.movimentacoes.length },
    { id: 'partes', label: 'Partes', icon: '👥', count: processo.partes.length },
    { id: 'documentos', label: 'Documentos / Autos', icon: '📁' },
    ...(temRelacionados ? [{
      id: 'relacionados' as TabType,
      label: 'Relacionados',
      icon: '🔗',
      count: processo.processosRelacionados.length + processo.incidentes.length
    }] : []),
  ];

  const movimentacoesToShow = showAllMovimentacoes
    ? processo.movimentacoes
    : processo.movimentacoes.slice(0, 10);

  const getTipoParteColor = (tipo: string) => {
    const t = tipo.toLowerCase();
    if (t.includes('autor') || t.includes('requerente') || t.includes('exequente') || t.includes('impetrante')) {
      return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: '👤' };
    }
    if (t.includes('réu') || t.includes('requerido') || t.includes('executado') || t.includes('impetrado')) {
      return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: '🏢' };
    }
    if (t.includes('advogad')) {
      return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', icon: '⚖️' };
    }
    if (t.includes('terceiro') || t.includes('interessado')) {
      return { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', icon: '👥' };
    }
    return { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30', icon: '👤' };
  };

  const handleClickProcessoRelacionado = (proc: Incidente) => {
    if (onBuscarProcesso && proc.numero) {
      // Passa a URL direta junto para busca mais confiável
      const url = proc.url || (proc.codigo && proc.foro 
        ? `https://esaj.tjsp.jus.br/cpopg/show.do?processo.codigo=${proc.codigo}&processo.foro=${proc.foro}&processo.numero=${encodeURIComponent(proc.numero)}`
        : undefined);
      onBuscarProcesso(proc.numero, url);
    } else if (proc.url) {
      window.open(proc.url, '_blank');
    } else if (proc.codigo && proc.foro) {
      const url = `https://esaj.tjsp.jus.br/cpopg/show.do?processo.codigo=${proc.codigo}&processo.foro=${proc.foro}&processo.numero=${encodeURIComponent(proc.numero)}`;
      window.open(url, '_blank');
    }
  };

  const handleAcessarAutos = () => {
    setTentandoAcessar(true);
    
    let url = '';
    if (processo.urlAutos) {
      url = processo.urlAutos;
    } else if (processo.codigoProcesso && processo.foroProcesso) {
      url = `https://esaj.tjsp.jus.br/cpopg/abrirPastaDigital.do?processo.codigo=${processo.codigoProcesso}&processo.foro=${processo.foroProcesso}`;
    }

    if (senhaProcesso) {
      url += (url.includes('?') ? '&' : '?') + `senhaProcesso=${encodeURIComponent(senhaProcesso)}`;
    }

    if (url) {
      window.open(url, '_blank');
    } else {
      // Fallback para a busca do processo
      const esajUrl = processo.urlOriginal || `https://esaj.tjsp.jus.br/cpopg/open.do`;
      window.open(esajUrl, '_blank');
    }
    
    setTimeout(() => setTentandoAcessar(false), 2000);
  };

  const handleAbrirEsaj = () => {
    const url = processo.urlOriginal || `https://esaj.tjsp.jus.br/cpopg/open.do`;
    window.open(url, '_blank');
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden">
      {/* Header do Processo */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-slate-800/0 border-b border-slate-700 p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {processo.situacao && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                {processo.situacao}
              </span>
            )}
            {processo.area && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-600/50 text-slate-300">
                {processo.area}
              </span>
            )}
            {processo.instancia && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-sky-500/20 text-sky-300 border border-sky-500/30">
                {processo.instancia}
              </span>
            )}
            {processo.sistema && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-700/80 text-slate-200 border border-slate-600">
                {processo.sistema.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 font-mono tracking-tight">
          {processo.numero}
        </h2>
        <p className="text-amber-400 text-base sm:text-lg font-medium">{processo.classe}</p>
        {processo.assunto && (
          <p className="text-slate-400 text-sm mt-1">{processo.assunto}</p>
        )}

        {/* Cards de info rápida */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
          {processo.valorAcao && (
            <InfoCard label="Valor da Ação" value={processo.valorAcao} icon="💰" />
          )}
          {processo.dataDistribuicao && (
            <InfoCard label="Distribuição" value={processo.dataDistribuicao} icon="📅" />
          )}
          {processo.ultimaAtualizacao && (
            <InfoCard label="Última Atualização" value={processo.ultimaAtualizacao} icon="🕒" />
          )}
          {processo.vara && (
            <InfoCard label="Vara" value={processo.vara} icon="🏛️" />
          )}
          {processo.juiz && (
            <InfoCard label="Juiz" value={processo.juiz} icon="⚖️" />
          )}
        </div>

        {/* Processos Relacionados Preview */}
        {temRelacionados && (
          <div className="mt-4 p-3 bg-purple-500/10 rounded-xl border border-purple-500/30">
            <p className="text-purple-400 text-xs font-medium mb-2 flex items-center gap-2">
              🔗 Processos Relacionados / Cumprimento de Sentença
            </p>
            <div className="flex flex-wrap gap-2">
              {[...processo.processosRelacionados, ...processo.incidentes].slice(0, 4).map((proc, idx) => (
                <button
                  key={idx}
                  onClick={() => handleClickProcessoRelacionado(proc)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-xs sm:text-sm font-mono transition-colors"
                >
                  {proc.numero}
                  {proc.classe && (
                    <span className="text-purple-400/70 text-xs hidden sm:inline">({proc.classe})</span>
                  )}
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              ))}
              {[...processo.processosRelacionados, ...processo.incidentes].length > 4 && (
                <button
                  onClick={() => setActiveTab('relacionados')}
                  className="text-purple-400 text-sm hover:underline px-2"
                >
                  +{[...processo.processosRelacionados, ...processo.incidentes].length - 4} mais
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-700 bg-slate-800/80">
        <div className="flex overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 sm:px-6 py-3.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-amber-500 text-amber-400 bg-slate-700/30'
                  : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-700/20'}`}
            >
              <span>{tab.icon}</span>
              <span className="hidden xs:inline">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-600 text-slate-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6 max-h-[65vh] overflow-y-auto">

        {/* === DETALHES === */}
        {activeTab === 'detalhes' && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <SectionTitle icon="📋" color="amber" title="Informações do Processo" />
                <div className="bg-slate-700/30 rounded-xl p-4 space-y-3 border border-slate-600/50">
                  <InfoRow label="Número" value={processo.numero} mono />
                  <InfoRow label="Classe" value={processo.classe} />
                  <InfoRow label="Assunto" value={processo.assunto} />
                  {processo.area && <InfoRow label="Área" value={processo.area} />}
                  {processo.valorAcao && <InfoRow label="Valor da Ação" value={processo.valorAcao} />}
                  {processo.outrasNumeracoes.length > 0 && (
                    <InfoRow label="Outras Numerações" value={processo.outrasNumeracoes.join(', ')} />
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <SectionTitle icon="🏛️" color="emerald" title="Localização" />
                <div className="bg-slate-700/30 rounded-xl p-4 space-y-3 border border-slate-600/50">
                  {processo.foro && <InfoRow label="Foro" value={processo.foro} />}
                  {processo.vara && <InfoRow label="Vara" value={processo.vara} />}
                  {processo.juiz && <InfoRow label="Juiz" value={processo.juiz} />}
                  {processo.dataDistribuicao && <InfoRow label="Distribuição" value={processo.dataDistribuicao} />}
                </div>
              </div>
            </div>

            {/* Petições Diversas */}
            {processo.peticoesDiversas.length > 0 && (
              <div className="space-y-4">
                <SectionTitle icon="📝" color="blue" title={`Petições Diversas (${processo.peticoesDiversas.length})`} />
                <div className="bg-slate-700/30 rounded-xl border border-slate-600/50 divide-y divide-slate-600/50">
                  {processo.peticoesDiversas.map((pet, i) => (
                    <div key={i} className="p-3 flex items-center gap-3">
                      <span className="text-xs text-slate-500 font-mono whitespace-nowrap bg-slate-800 px-2 py-1 rounded">
                        {pet.data}
                      </span>
                      <span className="text-sm text-slate-300">{pet.tipo}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Última Movimentação */}
            {processo.movimentacoes.length > 0 && (
              <div className="space-y-4">
                <SectionTitle icon="🔔" color="purple" title="Última Movimentação" />
                <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl p-4 border border-purple-500/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">📄</span>
                      <div>
                        <p className="font-semibold text-white">{processo.movimentacoes[0].titulo}</p>
                        <p className="text-sm text-slate-400 mt-1">{processo.movimentacoes[0].data}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('movimentacoes')}
                      className="px-3 py-2 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 text-xs sm:text-sm font-medium whitespace-nowrap"
                    >
                      Ver histórico
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Preview Partes */}
            {processo.partes.length > 0 && (
              <div className="space-y-4">
                <SectionTitle icon="👥" color="orange" title="Partes Principais" />
                <div className="grid md:grid-cols-2 gap-3">
                  {processo.partes.slice(0, 4).map((parte: Parte, index: number) => {
                    const colors = getTipoParteColor(parte.tipo);
                    return (
                      <div key={index} className={`bg-slate-700/30 rounded-xl p-4 border ${colors.border}`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 ${colors.bg} rounded-lg flex items-center justify-center text-lg flex-shrink-0`}>
                            {colors.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${colors.bg} ${colors.text} mb-1`}>
                              {parte.tipo}
                            </span>
                            <p className="font-medium text-white text-sm truncate">{parte.nome}</p>
                            {parte.advogados.length > 0 && (
                              <p className="text-xs text-slate-400 mt-1 truncate">
                                Adv: {parte.advogados[0]}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {processo.partes.length > 4 && (
                  <button
                    onClick={() => setActiveTab('partes')}
                    className="text-sm text-amber-400 hover:underline"
                  >
                    Ver todas as {processo.partes.length} partes →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* === MOVIMENTAÇÕES === */}
        {activeTab === 'movimentacoes' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">
              Histórico de Movimentações ({processo.movimentacoes.length})
            </h3>

            {processo.movimentacoes.length === 0 ? (
              <EmptyState icon="📭" message="Nenhuma movimentação encontrada" />
            ) : (
              <>
                <div className="relative">
                  <div className="absolute left-[23px] top-0 bottom-0 w-0.5 bg-slate-700"></div>

                  <div className="space-y-3">
                    {movimentacoesToShow.map((mov: Movimentacao, index: number) => (
                      <div key={index} className="relative flex gap-4">
                        <div className={`w-12 h-12 rounded-xl bg-slate-700 border-2 flex items-center justify-center text-lg z-10 flex-shrink-0 ${
                          index === 0 ? 'ring-2 ring-amber-500/50 border-amber-500 bg-amber-500/10' : 'border-slate-600'
                        }`}>
                          {index === 0 ? '🔔' : '📄'}
                        </div>
                        <div className={`flex-1 bg-slate-700/30 rounded-xl p-4 border ${
                          index === 0 ? 'border-amber-500/30 ring-1 ring-amber-500/20' : 'border-slate-600/50'
                        }`}>
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-white text-sm leading-relaxed flex-1">{mov.titulo}</p>
                            <span className="text-xs text-slate-500 whitespace-nowrap font-mono bg-slate-800 px-2 py-1 rounded flex-shrink-0">
                              {mov.data}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {processo.movimentacoes.length > 10 && (
                  <div className="text-center pt-4">
                    <button
                      onClick={() => setShowAllMovimentacoes(!showAllMovimentacoes)}
                      className="px-6 py-2 bg-amber-500/20 text-amber-400 font-medium rounded-xl hover:bg-amber-500/30 transition-colors"
                    >
                      {showAllMovimentacoes
                        ? 'Mostrar menos'
                        : `Ver todas as ${processo.movimentacoes.length} movimentações`
                      }
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* === PARTES === */}
        {activeTab === 'partes' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">
              Partes do Processo ({processo.partes.length})
            </h3>

            {processo.partes.length === 0 ? (
              <EmptyState icon="👥" message="Nenhuma parte encontrada" />
            ) : (
              <div className="grid gap-3">
                {processo.partes.map((parte: Parte, index: number) => {
                  const colors = getTipoParteColor(parte.tipo);
                  return (
                    <div key={index} className={`bg-slate-700/30 rounded-xl p-5 border ${colors.border}`}>
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${colors.bg} flex-shrink-0`}>
                          {colors.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${colors.bg} ${colors.text} mb-1`}>
                            {parte.tipo.toUpperCase()}
                          </span>
                          <h4 className="text-base sm:text-lg font-semibold text-white">{parte.nome}</h4>
                          {parte.advogados.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-600/50">
                              <p className="text-xs text-slate-500 mb-1.5">Advogado(s):</p>
                              {parte.advogados.map((adv, advIndex) => (
                                <p key={advIndex} className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                  <span className="text-blue-400">⚖️</span> {adv}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* === DOCUMENTOS / AUTOS === */}
        {activeTab === 'documentos' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white mb-2">
              Documentos e Autos Digitais
            </h3>

            {/* Informação sobre acesso */}
            <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl p-5 border border-blue-500/30">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center text-3xl flex-shrink-0">
                  📁
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-white text-lg mb-1">Pasta Digital / Autos</h4>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Os documentos e autos do processo estão disponíveis no e-SAJ do TJSP. 
                    Para acessar, pode ser necessário informar a <strong className="text-blue-300">senha do processo</strong> 
                    {' '}(fornecida pelo advogado ou na intimação).
                  </p>
                </div>
              </div>
            </div>

            {/* Campo de senha + botão de acesso */}
            <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-600/50">
              <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-xl">🔐</span>
                Acessar Autos / Documentos
              </h4>

              <div className="space-y-4">
                {/* Senha */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Senha do Processo <span className="text-slate-500">(opcional - apenas se necessário)</span>
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="password"
                      value={senhaProcesso}
                      onChange={(e) => setSenhaProcesso(e.target.value)}
                      placeholder="Digite a senha do processo..."
                      className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Botões de acesso */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleAcessarAutos}
                    disabled={tentandoAcessar}
                    className="flex-1 px-6 py-3.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-400 hover:to-blue-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                  >
                    {tentandoAcessar ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Abrindo...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                        </svg>
                        Abrir Pasta Digital no e-SAJ
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleAbrirEsaj}
                    className="px-6 py-3.5 bg-slate-700 text-slate-300 font-semibold rounded-xl hover:bg-slate-600 transition-colors flex items-center justify-center gap-2 border border-slate-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Abrir Processo no e-SAJ
                  </button>
                </div>
              </div>
            </div>

            {/* Instruções de acesso */}
            <div className="bg-slate-700/20 rounded-xl p-5 border border-slate-600/30 space-y-4">
              <h4 className="font-semibold text-white flex items-center gap-2">
                <span className="text-xl">ℹ️</span>
                Como acessar os documentos
              </h4>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400 font-bold text-sm flex-shrink-0">1</div>
                    <div>
                      <p className="text-sm font-medium text-slate-300">Processo Público</p>
                      <p className="text-xs text-slate-500">Clique em "Abrir Pasta Digital" para ver os documentos sem senha</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 font-bold text-sm flex-shrink-0">2</div>
                    <div>
                      <p className="text-sm font-medium text-slate-300">Processo com Senha</p>
                      <p className="text-xs text-slate-500">Informe a senha recebida na intimação ou com seu advogado</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center text-amber-400 font-bold text-sm flex-shrink-0">3</div>
                    <div>
                      <p className="text-sm font-medium text-slate-300">Segredo de Justiça</p>
                      <p className="text-xs text-slate-500">Requer certificado digital (advogado) para acesso</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center text-purple-400 font-bold text-sm flex-shrink-0">4</div>
                    <div>
                      <p className="text-sm font-medium text-slate-300">Dúvidas</p>
                      <p className="text-xs text-slate-500">Consulte seu advogado ou entre em contato com a vara responsável</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Petições Diversas como documentos */}
            {processo.peticoesDiversas.length > 0 && (
              <div className="space-y-3">
                <SectionTitle icon="📝" color="amber" title={`Petições Protocoladas (${processo.peticoesDiversas.length})`} />
                <div className="bg-slate-700/30 rounded-xl border border-slate-600/50 divide-y divide-slate-600/30">
                  {processo.peticoesDiversas.map((pet, i) => (
                    <div key={i} className="p-3 flex items-center gap-3 hover:bg-slate-700/30 transition-colors">
                      <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
                        📄
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-300 truncate">{pet.tipo}</p>
                        <p className="text-xs text-slate-500">{pet.data}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* === RELACIONADOS === */}
        {activeTab === 'relacionados' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">
              Processos Relacionados ({processo.processosRelacionados.length + processo.incidentes.length})
            </h3>

            {processo.processosRelacionados.length === 0 && processo.incidentes.length === 0 ? (
              <EmptyState icon="🔗" message="Nenhum processo relacionado encontrado" />
            ) : (
              <div className="grid gap-3">
                {processo.processosRelacionados.map((proc, index) => (
                  <RelatedProcessCard
                    key={`rel-${index}`}
                    proc={proc}
                    type="related"
                    onClick={() => handleClickProcessoRelacionado(proc)}
                  />
                ))}
                {processo.incidentes.map((inc, index) => (
                  <RelatedProcessCard
                    key={`inc-${index}`}
                    proc={inc}
                    type="incident"
                    onClick={() => handleClickProcessoRelacionado(inc)}
                  />
                ))}
              </div>
            )}

            <p className="text-xs text-slate-500 text-center mt-4">
              Clique em um processo para abrir os detalhes
            </p>
          </div>
        )}
      </div>

      {/* Footer com link e-SAJ */}
      <div className="border-t border-slate-700 p-4 bg-slate-800/50 flex flex-col sm:flex-row justify-between items-center gap-3">
        <p className="text-xs text-slate-500">
          Dados obtidos do e-SAJ TJSP • Processo {processo.numero}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('documentos')}
            className="px-4 py-2 bg-blue-500/20 text-blue-400 font-medium rounded-lg hover:bg-blue-500/30 transition-colors text-sm flex items-center gap-1.5"
          >
            📁 Ver Autos
          </button>
          <a
            href={processo.urlOriginal || `https://esaj.tjsp.jus.br/cpopg/open.do`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-amber-500 text-slate-900 font-semibold rounded-lg hover:bg-amber-400 transition-colors text-sm flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Abrir no e-SAJ
          </a>
        </div>
      </div>
    </div>
  );
}

// === Helper Components ===

function InfoCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-slate-700/50 rounded-xl p-3 border border-slate-600">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">{icon}</span>
        <p className="text-slate-400 text-xs">{label}</p>
      </div>
      <p className="text-white font-bold text-sm truncate">{value}</p>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-slate-400 text-sm flex-shrink-0">{label}:</span>
      <span className={`font-medium text-white text-right text-sm ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function SectionTitle({ icon, color, title }: { icon: string; color: string; title: string }) {
  const colorClasses: Record<string, string> = {
    amber: 'bg-amber-500/20 text-amber-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    blue: 'bg-blue-500/20 text-blue-400',
    purple: 'bg-purple-500/20 text-purple-400',
    orange: 'bg-orange-500/20 text-orange-400',
  };

  return (
    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClasses[color] || colorClasses.amber}`}>
        {icon}
      </span>
      {title}
    </h3>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="text-center py-12 text-slate-400">
      <span className="text-5xl mb-4 block">{icon}</span>
      <p className="text-slate-500">{message}</p>
    </div>
  );
}

function RelatedProcessCard({ proc, type, onClick }: { proc: Incidente; type: 'related' | 'incident'; onClick: () => void }) {
  const isRelated = type === 'related';
  const bgColor = isRelated ? 'bg-purple-500/20' : 'bg-blue-500/20';
  const borderHover = isRelated ? 'hover:border-purple-500/50' : 'hover:border-blue-500/50';
  const textColor = isRelated ? 'text-purple-400' : 'text-blue-400';
  const hoverText = isRelated ? 'group-hover:text-purple-400' : 'group-hover:text-blue-400';
  const iconEmoji = isRelated ? '📑' : '📎';
  const defaultLabel = isRelated ? 'PROCESSO RELACIONADO' : 'INCIDENTE';

  return (
    <div
      onClick={onClick}
      className={`bg-slate-700/30 rounded-xl p-5 border border-slate-600/50 ${borderHover} hover:bg-slate-700/50 cursor-pointer transition-all group`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${bgColor} flex-shrink-0`}>
            {iconEmoji}
          </div>
          <div>
            <span className={`px-2 py-0.5 text-xs font-semibold rounded ${bgColor} ${textColor} mb-2 inline-block`}>
              {proc.classe || defaultLabel}
            </span>
            <h4 className="text-base sm:text-lg font-semibold text-white font-mono">{proc.numero}</h4>
            {proc.assunto && (
              <p className="text-sm text-slate-400 mt-1">{proc.assunto}</p>
            )}
            {proc.dataDistribuicao && (
              <p className="text-xs text-slate-500 mt-1">Distribuído em: {proc.dataDistribuicao}</p>
            )}
          </div>
        </div>
        <div className={`flex-shrink-0 text-slate-500 ${hoverText} transition-colors`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </div>
      </div>
    </div>
  );
}
