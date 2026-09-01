import { ProcessoTJSP, Parte, Movimentacao, Peticao, Incidente } from '../types/processo';
import { buscarResultadoDataJud, buscarProcessoDataJud } from './datajudService';

const MAX_RESULTADOS_POR_SISTEMA = 15;
const REQUEST_TIMEOUT_MS = 9000;

const LIMITES_MODO = {
  rapida: {
    paginasPorSistema: 1,
    sistemasNomeDocumento: ['cpopg', 'cposg'],
  },
  completa: {
    paginasPorSistema: 3,
    sistemasNomeDocumento: ['cpopg', 'cposg', 'cposgcr'],
  },
} as const;

const cacheBusca = new Map<string, ResultadoBusca[]>();
const cacheDetalhes = new Map<string, ProcessoTJSP>();

const CORS_PROXIES = [
  { name: 'corsproxy.io', fn: (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}` },
  { name: 'allorigins', fn: (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` },
  { name: 'codetabs', fn: (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}` },
];

let workingProxyIndex = 0;

async function fetchWithProxy(url: string, timeout = REQUEST_TIMEOUT_MS): Promise<string> {
  const errors: string[] = [];

  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxyIndex = (workingProxyIndex + i) % CORS_PROXIES.length;
    const proxy = CORS_PROXIES[proxyIndex];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(proxy.fn(url), {
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.5',
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        errors.push(`${proxy.name}: HTTP ${response.status}`);
        continue;
      }

      const text = await response.text();
      if (!text || text.length < 200) {
        errors.push(`${proxy.name}: resposta vazia`);
        continue;
      }

      workingProxyIndex = proxyIndex;
      return text;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${proxy.name}: ${msg}`);
    }
  }

  throw new Error(`PROXY_FAILED:${errors.join('; ')}`);
}

export type TipoBusca = 'NUMPROC' | 'NMPARTE' | 'DOCPARTE';
export type ModoConsulta = 'rapida' | 'completa';

export interface ResultadoBusca {
  codigo: string;
  foro: string;
  numero: string;
  classe: string;
  assunto: string;
  foro_nome: string;
  vara: string;
  dataDistribuicao: string;
  urlDireta: string;
  instancia: string;
  sistema: string;
  origemLabel: string;
}

type SistemaBusca = {
  id: string;
  nome: string;
  instancia: string;
  baseUrl: string;
  numeroBase?: string;
  suportaNome: boolean;
  suportaDocumento: boolean;
  suportaNumero: boolean;
  urlBuilder: (termo: string, tipo: TipoBusca, pagina?: number) => string | null;
  urlShowBuilder?: (codigo: string, foro: string, numero: string) => string;
};

const SISTEMAS: SistemaBusca[] = [
  {
    id: 'cpopg',
    nome: 'Consulta de Processos do 1º Grau',
    instancia: '1º Grau',
    baseUrl: 'https://esaj.tjsp.jus.br/cpopg',
    numeroBase: 'https://esaj.tjsp.jus.br/cpopg',
    suportaNome: true,
    suportaDocumento: true,
    suportaNumero: true,
    urlBuilder: (termo, tipo, pagina = 0) => {
      if (tipo === 'NMPARTE') {
        return `https://esaj.tjsp.jus.br/cpopg/search.do?conversationId=&paginaConsulta=${pagina}&localPesquisa.cdLocal=-1&cbPesquisa=NMPARTE&dePesquisa=${encodeURIComponent(termo)}`;
      }
      if (tipo === 'DOCPARTE') {
        return `https://esaj.tjsp.jus.br/cpopg/search.do?conversationId=&paginaConsulta=${pagina}&localPesquisa.cdLocal=-1&cbPesquisa=DOCPARTE&dePesquisa=${termo.replace(/\D/g, '')}`;
      }
      const parsed = parseNumeroCNJ(termo);
      if (!parsed) return null;
      return `https://esaj.tjsp.jus.br/cpopg/search.do?conversationId=&paginaConsulta=${pagina}&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=${parsed.digitoAno}&foroNumeroUnificado=${parsed.oooo}&dePesquisaNuUnificado=${parsed.formatted}&dePesquisa=&tipoNuProcesso=UNIFICADO`;
    },
    urlShowBuilder: (codigo, foro, numero) => `https://esaj.tjsp.jus.br/cpopg/show.do?processo.codigo=${codigo}&processo.foro=${foro}&processo.numero=${encodeURIComponent(numero)}`,
  },
  {
    id: 'cposg',
    nome: 'Consulta de Processos do 2º Grau',
    instancia: '2º Grau',
    baseUrl: 'https://esaj.tjsp.jus.br/cposg',
    numeroBase: 'https://esaj.tjsp.jus.br/cposg',
    suportaNome: true,
    suportaDocumento: true,
    suportaNumero: true,
    urlBuilder: (termo, tipo, pagina = 0) => {
      if (tipo === 'NMPARTE') {
        return `https://esaj.tjsp.jus.br/cposg/search.do?conversationId=&paginaConsulta=${pagina}&cbPesquisa=NMPARTE&dePesquisa=${encodeURIComponent(termo)}`;
      }
      if (tipo === 'DOCPARTE') {
        return `https://esaj.tjsp.jus.br/cposg/search.do?conversationId=&paginaConsulta=${pagina}&cbPesquisa=DOCPARTE&dePesquisa=${termo.replace(/\D/g, '')}`;
      }
      const parsed = parseNumeroCNJ(termo);
      if (!parsed) return null;
      return `https://esaj.tjsp.jus.br/cposg/search.do?conversationId=&paginaConsulta=${pagina}&cbPesquisa=NUMPROC&dePesquisaNuUnificado=${parsed.formatted}`;
    },
    urlShowBuilder: (codigo, foro, numero) => `https://esaj.tjsp.jus.br/cposg/show.do?processo.codigo=${codigo}&processo.foro=${foro}&processo.numero=${encodeURIComponent(numero)}`,
  },
  {
    id: 'cposgcr',
    nome: 'Colégio Recursal / Turma de Uniformização',
    instancia: 'Colégio Recursal',
    baseUrl: 'https://esaj.tjsp.jus.br/cposgcr',
    numeroBase: 'https://esaj.tjsp.jus.br/cposgcr',
    suportaNome: true,
    suportaDocumento: true,
    suportaNumero: true,
    urlBuilder: (termo, tipo, pagina = 0) => {
      if (tipo === 'NMPARTE') {
        return `https://esaj.tjsp.jus.br/cposgcr/search.do?conversationId=&paginaConsulta=${pagina}&cbPesquisa=NMPARTE&dePesquisa=${encodeURIComponent(termo)}`;
      }
      if (tipo === 'DOCPARTE') {
        return `https://esaj.tjsp.jus.br/cposgcr/search.do?conversationId=&paginaConsulta=${pagina}&cbPesquisa=DOCPARTE&dePesquisa=${termo.replace(/\D/g, '')}`;
      }
      const parsed = parseNumeroCNJ(termo);
      if (!parsed) return null;
      return `https://esaj.tjsp.jus.br/cposgcr/search.do?conversationId=&paginaConsulta=${pagina}&cbPesquisa=NUMPROC&numeroDigitoAnoUnificado=${parsed.digitoAno}&foroNumeroUnificado=${parsed.oooo}&dePesquisaNuUnificado=${parsed.formatted}&dePesquisa=&tipoNuProcesso=UNIFICADO`;
    },
    urlShowBuilder: (codigo, foro, numero) => `https://esaj.tjsp.jus.br/cposgcr/show.do?processo.codigo=${codigo}&processo.foro=${foro}&processo.numero=${encodeURIComponent(numero)}`,
  },
  {
    id: 'cjpg',
    nome: 'Consulta de Julgados do 1º Grau',
    instancia: 'Julgados 1º Grau',
    baseUrl: 'https://esaj.tjsp.jus.br/cjpg',
    suportaNome: true,
    suportaDocumento: false,
    suportaNumero: false,
    urlBuilder: (termo, tipo, pagina = 0) => {
      if (tipo !== 'NMPARTE') return null;
      return `https://esaj.tjsp.jus.br/cjpg/resultadoSimples.do?conversationId=&pagina=${pagina}&dadosConsulta.pesquisaLivre=${encodeURIComponent(termo)}`;
    },
  },
  {
    id: 'cjsg',
    nome: 'Consulta de Julgados do 2º Grau',
    instancia: 'Julgados 2º Grau',
    baseUrl: 'https://esaj.tjsp.jus.br/cjsg',
    suportaNome: true,
    suportaDocumento: false,
    suportaNumero: false,
    urlBuilder: (termo, tipo, pagina = 0) => {
      if (tipo !== 'NMPARTE') return null;
      return `https://esaj.tjsp.jus.br/cjsg/resultadoCompleta.do?conversationId=&pagina=${pagina}&dadosConsulta.pesquisaLivre=${encodeURIComponent(termo)}`;
    },
  },
];

function getSistemasParaBusca(tipo: TipoBusca): SistemaBusca[] {
  const filtrados = SISTEMAS.filter((s) => {
    if (tipo === 'NMPARTE') return s.suportaNome;
    if (tipo === 'DOCPARTE') return s.suportaDocumento;
    return s.suportaNumero;
  });

  if (tipo === 'NUMPROC') {
    return filtrados.filter((s) => ['cpopg', 'cposg', 'cposgcr'].includes(s.id));
  }

  if (tipo === 'DOCPARTE') {
    return filtrados.filter((s) => ['cpopg', 'cposg', 'cposgcr'].includes(s.id));
  }

  return filtrados.filter((s) => ['cpopg', 'cposg', 'cposgcr'].includes(s.id));
}

export function gerarUrlBuscaEsaj(termo: string, tipo: TipoBusca): string {
  const sistema = tipo === 'NUMPROC' ? SISTEMAS[0] : SISTEMAS[0];
  return sistema.urlBuilder(termo, tipo, 0) || 'https://esaj.tjsp.jus.br/cpopg/open.do';
}

export function gerarUrlsBuscaOficial(termo: string, tipo: TipoBusca): Array<{
  id: string;
  label: string;
  instancia: string;
  url: string;
}> {
  return getSistemasParaBusca(tipo)
    .map((sistema) => ({
      id: sistema.id,
      label: sistema.nome,
      instancia: sistema.instancia,
      url: sistema.urlBuilder(termo, tipo, 0) || sistema.baseUrl,
    }))
    .filter((item) => !!item.url);
}

function isPaginaProcesso(html: string): boolean {
  return (
    html.includes('numeroProcesso') ||
    html.includes('classeProcesso') ||
    html.includes('Partes do processo') ||
    html.includes('Movimentações')
  );
}

function parseNumeroCNJ(termo: string): { formatted: string; digitoAno: string; oooo: string } | null {
  const cleaned = termo.replace(/\s+/g, '').trim();
  const match = cleaned.match(/(\d{7})-?(\d{2})\.?(\d{4})\.?(\d)\.?(\d{2})\.?(\d{4})/);
  if (match) {
    return {
      formatted: `${match[1]}-${match[2]}.${match[3]}.${match[4]}.${match[5]}.${match[6]}`,
      digitoAno: `${match[1]}-${match[2]}.${match[3]}`,
      oooo: match[6],
    };
  }
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length >= 20) {
    const n = digits.substring(0, 7);
    const d = digits.substring(7, 9);
    const a = digits.substring(9, 13);
    const j = digits.substring(13, 14);
    const tr = digits.substring(14, 16);
    const o = digits.substring(16, 20);
    return {
      formatted: `${n}-${d}.${a}.${j}.${tr}.${o}`,
      digitoAno: `${n}-${d}.${a}`,
      oooo: o,
    };
  }
  return null;
}

function texto(el?: Element | null): string {
  return el?.textContent?.trim().replace(/\s+/g, ' ') || '';
}

function normalizarNumeroProcesso(valor: string): string {
  return valor.replace(/\s+/g, '').trim();
}

function extrairResultadosDeLista(doc: Document, html: string, sistema: SistemaBusca): ResultadoBusca[] {
  const resultados: ResultadoBusca[] = [];
  const numerosVistos = new Set<string>();

  const adicionar = (item: Partial<ResultadoBusca> & { numero: string }) => {
    const numero = normalizarNumeroProcesso(item.numero);
    if (!numero || numerosVistos.has(numero)) return;
    numerosVistos.add(numero);
    resultados.push({
      codigo: item.codigo || '',
      foro: item.foro || '',
      numero,
      classe: item.classe || '',
      assunto: item.assunto || '',
      foro_nome: item.foro_nome || '',
      vara: item.vara || '',
      dataDistribuicao: item.dataDistribuicao || '',
      urlDireta: item.urlDireta || '',
      instancia: sistema.instancia,
      sistema: sistema.id,
      origemLabel: sistema.nome,
    });
  };

  const extrairNumeroDoTexto = (valor: string) => {
    const match = valor.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
    return match ? match[0] : '';
  };

  doc.querySelectorAll('a.linkProcesso, a[href*="show.do"], a[href*="processo.codigo"], a[href*="open.do"]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const numeroCandidato = extrairNumeroDoTexto(texto(link)) || extrairNumeroDoTexto(href) || normalizarNumeroProcesso(texto(link));
    if (!/\d{7}-\d{2}\.\d{4}/.test(numeroCandidato)) return;

    const codigoMatch = href.match(/processo\.codigo=([A-Z0-9]+)/i);
    const foroMatch = href.match(/processo\.foro=(\d+)/i);
    const row = link.closest('tr, li, .resultado, .fundocinza1');
    const cells = row?.querySelectorAll('td') || [];

    const urlDireta = href.startsWith('http')
      ? href
      : href
        ? `https://esaj.tjsp.jus.br${href.startsWith('/') ? '' : '/'}${href}`
        : (codigoMatch && foroMatch && sistema.urlShowBuilder
            ? sistema.urlShowBuilder(codigoMatch[1], foroMatch[1], numeroCandidato)
            : '');

    adicionar({
      codigo: codigoMatch?.[1] || '',
      foro: foroMatch?.[1] || '',
      numero: numeroCandidato,
      classe: texto(cells[1]) || texto(cells[2]) || texto(row?.querySelector('.classeProcesso, .classe')),
      assunto: texto(cells[2]) || texto(cells[3]) || texto(row?.querySelector('.assuntoProcesso, .assunto')),
      foro_nome: texto(cells[3]) || texto(cells[4]) || texto(row?.querySelector('.foroProcesso, .foro')),
      vara: texto(cells[4]) || texto(cells[5]) || texto(row?.querySelector('.varaProcesso, .vara')),
      dataDistribuicao: texto(cells[5]) || texto(cells[6]) || texto(row?.querySelector('.dataDistribuicao, .data')),
      urlDireta,
    });
  });

  if (resultados.length === 0) {
    const regex = /(?:processo\.codigo=([A-Z0-9]+).*?processo\.foro=(\d+).*?(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}))/gis;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const numero = match[3];
      adicionar({
        codigo: match[1],
        foro: match[2],
        numero,
        urlDireta: sistema.urlShowBuilder ? sistema.urlShowBuilder(match[1], match[2], numero) : '',
      });
    }
  }

  if (resultados.length === 0) {
    const numeros = html.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g) || [];
    numeros.forEach((numero) => adicionar({ numero }));
  }

  return resultados;
}

function extrairResultadoDeProcessoUnico(doc: Document, html: string, url: string, sistema: SistemaBusca): ResultadoBusca[] {
  const numero = normalizarNumeroProcesso(texto(doc.querySelector('#numeroProcesso')));
  if (!numero) return [];
  const codigoMatch = html.match(/processo\.codigo=([A-Z0-9]+)/i);
  const foroMatch = html.match(/processo\.foro=(\d+)/i);
  return [{
    codigo: codigoMatch?.[1] || '',
    foro: foroMatch?.[1] || '',
    numero,
    classe: texto(doc.querySelector('#classeProcesso')),
    assunto: texto(doc.querySelector('#assuntoProcesso')),
    foro_nome: texto(doc.querySelector('#foroProcesso')),
    vara: texto(doc.querySelector('#varaProcesso')),
    dataDistribuicao: texto(doc.querySelector('#dataHoraDistribuicaoProcesso')),
    urlDireta: url,
    instancia: sistema.instancia,
    sistema: sistema.id,
    origemLabel: sistema.nome,
  }];
}

async function buscarEmSistema(
  sistema: SistemaBusca,
  termo: string,
  tipo: TipoBusca,
  modo: ModoConsulta,
): Promise<ResultadoBusca[]> {
  const parser = new DOMParser();
  const acumulados: ResultadoBusca[] = [];
  const vistos = new Set<string>();
  const paginasLimite = tipo === 'NUMPROC' ? 1 : LIMITES_MODO[modo].paginasPorSistema;
  const paginas = Array.from({ length: paginasLimite }, (_, i) => i);

  const adicionarResultados = (paginaResultados: ResultadoBusca[]) => {
    for (const r of paginaResultados) {
      const key = `${r.sistema}::${r.numero}`;
      if (!vistos.has(key)) {
        vistos.add(key);
        acumulados.push(r);
      }
    }
  };

  for (const pagina of paginas) {
    if (acumulados.length >= MAX_RESULTADOS_POR_SISTEMA) break;

    const url = sistema.urlBuilder(termo, tipo, pagina);
    if (!url) continue;

    try {
      const html = await fetchWithProxy(url);
      const doc = parser.parseFromString(html, 'text/html');

      if (isPaginaProcesso(html)) {
        const processoUnico = extrairResultadoDeProcessoUnico(doc, html, url, sistema);
        adicionarResultados(processoUnico);

        const relacionadosDaPagina = extrairResultadosDeLista(doc, html, sistema);
        adicionarResultados(relacionadosDaPagina);

        if (tipo === 'NUMPROC') break;
        continue;
      }

      const paginaResultados = extrairResultadosDeLista(doc, html, sistema);
      adicionarResultados(paginaResultados);

      const totalEncontradosMatch = html.match(/(\d+)\s+Processos? encontrados/i);
      const mostrandoAteMatch = html.match(/Mostrando\s+de\s+\d+\s+at[eé]\s+(\d+)/i);
      const mostrandoAte = Number(mostrandoAteMatch?.[1] || 0);
      const totalEncontrados = Number(totalEncontradosMatch?.[1] || 0);

      if (paginaResultados.length === 0) break;
      if (totalEncontrados > 0 && mostrandoAte > 0 && mostrandoAte >= totalEncontrados) break;
    } catch (e) {
      if (tipo === 'NUMPROC' && e instanceof Error && e.message.startsWith('PROXY_FAILED:')) {
        throw e;
      }
      continue;
    }
  }

  return acumulados;
}

export async function buscarProcessos(
  termo: string,
  tipo: TipoBusca,
  modo: ModoConsulta = 'rapida',
): Promise<ResultadoBusca[]> {
  const cacheKey = `${modo}::${tipo}::${termo.trim().toLowerCase()}`;
  const cached = cacheBusca.get(cacheKey);
  if (cached) return cached;

  let sistemas = getSistemasParaBusca(tipo);
  if (tipo !== 'NUMPROC') {
    const permitidos = new Set<string>(LIMITES_MODO[modo].sistemasNomeDocumento as readonly string[]);
    sistemas = sistemas.filter((s) => permitidos.has(s.id));
  }

  const buscaScraping = Promise.allSettled(sistemas.map((s) => buscarEmSistema(s, termo, tipo, modo)));

  // DataJud (CNJ) roda em paralelo: cobre tanto SAJ quanto eproc, então
  // funciona mesmo para processos já migrados que o scraping do e-SAJ não
  // encontra mais.
  const buscaDataJud: Promise<ResultadoBusca[]> =
    tipo === 'NUMPROC'
      ? buscarResultadoDataJud(termo)
          .then((r) => (r ? [r] : []))
          .catch(() => [])
      : Promise.resolve([]);

  const [resultados, resultadosDataJud] = await Promise.all([buscaScraping, buscaDataJud]);

  const listas = resultados
    .filter((r): r is PromiseFulfilledResult<ResultadoBusca[]> => r.status === 'fulfilled')
    .map((r) => r.value);

  const houveSucessoScraping = listas.length > 0;
  const totalResultadosScraping = listas.flat().length;

  if (!houveSucessoScraping && resultadosDataJud.length === 0) {
    const falhas = resultados
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));
    throw new Error(falhas[0] || 'Falha ao consultar os sistemas disponíveis.');
  }

  if (totalResultadosScraping === 0 && resultadosDataJud.length === 0) {
    cacheBusca.set(cacheKey, []);
    return [];
  }

  const deduplicados = deduplicarResultados([...resultadosDataJud, ...listas.flat()]);
  cacheBusca.set(cacheKey, deduplicados);
  return deduplicados;
}

function deduplicarResultados(lista: ResultadoBusca[]): ResultadoBusca[] {
  const mapa = new Map<string, ResultadoBusca>();
  for (const item of lista) {
    const chave = `${item.sistema}::${item.numero}`;
    if (!mapa.has(chave)) {
      mapa.set(chave, item);
      continue;
    }
    const existente = mapa.get(chave)!;
    mapa.set(chave, {
      ...existente,
      classe: existente.classe || item.classe,
      assunto: existente.assunto || item.assunto,
      foro_nome: existente.foro_nome || item.foro_nome,
      vara: existente.vara || item.vara,
      dataDistribuicao: existente.dataDistribuicao || item.dataDistribuicao,
      codigo: existente.codigo || item.codigo,
      foro: existente.foro || item.foro,
      urlDireta: existente.urlDireta || item.urlDireta,
    });
  }
  return Array.from(mapa.values()).sort((a, b) => a.numero.localeCompare(b.numero));
}

export async function buscarDetalhesProcessoPorUrl(url: string): Promise<ProcessoTJSP | null> {
  const cached = cacheDetalhes.get(url);
  if (cached) return cached;

  if (url.startsWith('datajud://')) {
    const numero = url.replace('datajud://', '');
    const processo = await buscarProcessoDataJud(numero);
    if (processo) cacheDetalhes.set(url, processo);
    return processo;
  }

  const html = await fetchWithProxy(url);
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  if (!isPaginaProcesso(html)) {
    const sistema = detectarSistemaPorUrl(url);
    const resultados = extrairResultadosDeLista(doc, html, sistema);
    if (resultados.length > 0) {
      const r = resultados[0];
      return buscarDetalhesProcesso(r.codigo, r.foro, r.numero, r.sistema, r.urlDireta);
    }
    return null;
  }

  const sistema = detectarSistemaPorUrl(url);
  const numero = normalizarNumeroProcesso(texto(doc.querySelector('#numeroProcesso')));
  const codigoMatch = html.match(/processo\.codigo=([A-Z0-9]+)/i);
  const foroMatch = html.match(/processo\.foro=(\d+)/i);
  const processo = extrairInformacoesProcesso(doc, html, numero, url, codigoMatch?.[1], foroMatch?.[1], sistema);
  cacheDetalhes.set(url, processo);
  return processo;
}

function detectarSistemaPorUrl(url: string): SistemaBusca {
  return SISTEMAS.find((s) => url.includes(`/${s.id}/`)) || SISTEMAS[0];
}

export async function buscarDetalhesProcesso(
  codigo: string,
  foro: string,
  numero: string,
  sistemaId = 'cpopg',
  urlDireta?: string,
): Promise<ProcessoTJSP | null> {
  if (sistemaId === 'datajud') {
    return buscarDetalhesProcessoPorUrl(urlDireta || `datajud://${numero.replace(/\D/g, '')}`);
  }

  const sistema = SISTEMAS.find((s) => s.id === sistemaId) || SISTEMAS[0];
  let url = urlDireta || '';

  if (!url) {
    if (codigo && foro && sistema.urlShowBuilder) {
      url = sistema.urlShowBuilder(codigo, foro, numero);
    } else {
      url = sistema.urlBuilder(numero, 'NUMPROC', 0) || '';
    }
  }

  if (!url) return null;

  const cached = cacheDetalhes.get(url);
  if (cached) return cached;

  const html = await fetchWithProxy(url);
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  if (!isPaginaProcesso(html)) {
    const resultados = extrairResultadosDeLista(doc, html, sistema);
    const item = resultados.find((r) => r.numero === numero) || resultados[0];
    if (!item) return null;
    if (item.urlDireta && item.urlDireta !== url) {
      return buscarDetalhesProcesso(item.codigo, item.foro, item.numero, item.sistema, item.urlDireta);
    }
  }

  const processo = extrairInformacoesProcesso(doc, html, numero, url, codigo, foro, sistema);
  cacheDetalhes.set(url, processo);
  return processo;
}

function extrairInformacoesProcesso(
  doc: Document,
  html: string,
  numeroOriginal: string,
  urlOriginal: string,
  codigoProcesso?: string,
  foroProcesso?: string,
  sistema?: SistemaBusca,
): ProcessoTJSP {
  const getById = (id: string) => texto(doc.getElementById(id));

  if (!codigoProcesso) {
    codigoProcesso = html.match(/processo\.codigo=([A-Z0-9]+)/i)?.[1] || '';
  }
  if (!foroProcesso) {
    foroProcesso = html.match(/processo\.foro=(\d+)/i)?.[1] || '';
  }

  const numero = normalizarNumeroProcesso(getById('numeroProcesso')) || numeroOriginal;
  const classe = getById('classeProcesso');
  const assunto = getById('assuntoProcesso');
  const foro = getById('foroProcesso');
  const vara = getById('varaProcesso');
  const juiz = getById('juizProcesso');
  const dataDistribuicao = getById('dataHoraDistribuicaoProcesso');
  const valorAcao = getById('valorAcaoProcesso');
  const area = getById('areaProcesso');
  const situacao = texto(doc.querySelector('.unj-tag, .situacaoProcesso, #labelSituacaoProcesso'));

  const partes = extrairPartes(doc, html);
  const movimentacoes = extrairMovimentacoes(doc);
  const ultimaAtualizacao =
    movimentacoes[0]?.data ||
    getById('dataHoraUltimaAtualizacaoProcesso') ||
    texto(doc.querySelector('#dataUltimaAtualizacaoProcesso, .dataUltimaAtualizacaoProcesso, .ultimaMovimentacao .dataMovimentacao'));

  const peticoesDiversas: Peticao[] = [];
  doc.querySelectorAll('#tabelaPeticoesDiversas tr').forEach((row) => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 2) {
      const data = texto(cells[0]);
      const tipo = texto(cells[1]);
      if (data && tipo) peticoesDiversas.push({ data, tipo });
    }
  });

  const incidentes = extrairIncidentes(doc, numero);
  const processosRelacionados = extrairProcessosRelacionados(doc, html, numero);

  const outrasNumeracoes: string[] = [];
  const outras = texto(doc.querySelector('#outrasNumeracoesProcesso'));
  if (outras) outrasNumeracoes.push(outras);

  let acessoAutos: ProcessoTJSP['acessoAutos'] = 'indisponivel';
  let urlAutos = '';
  const linkPasta = doc.querySelector('a[href*="abrirPastaDigital"], a[href*="pastaDigital"], #linkPasta, .linkPasta');
  if (linkPasta) {
    const href = linkPasta.getAttribute('href') || '';
    acessoAutos = 'publico';
    urlAutos = href.startsWith('http') ? href : `https://esaj.tjsp.jus.br${href}`;
  }
  if (codigoProcesso && foroProcesso && !urlAutos && sistema?.id === 'cpopg') {
    urlAutos = `https://esaj.tjsp.jus.br/cpopg/abrirPastaDigital.do?processo.codigo=${codigoProcesso}&processo.foro=${foroProcesso}`;
  }

  return {
    numero,
    classe,
    assunto,
    foro,
    vara,
    juiz,
    dataDistribuicao,
    ultimaAtualizacao,
    valorAcao,
    area,
    situacao,
    partes,
    movimentacoes,
    peticoesDiversas,
    incidentes,
    processosRelacionados,
    outrasNumeracoes,
    urlOriginal,
    codigoProcesso,
    foroProcesso,
    acessoAutos,
    urlAutos,
    instancia: sistema?.instancia,
    sistema: sistema?.id,
  };
}

function extrairPartes(doc: Document, html: string): Parte[] {
  const partes: Parte[] = [];
  const nomesVistos = new Set<string>();

  const tabelasPartes = [doc.querySelector('#tableTodasPartes'), doc.querySelector('#tablePartesPrincipais')].filter(Boolean);
  for (const tabela of tabelasPartes) {
    const rows = tabela?.querySelectorAll('tr') || [];
    let tipoAtual = '';
    rows.forEach((row) => {
      const tipoTd = row.querySelector('.tipoDeParticipacao');
      const nomeTd = row.querySelector('.nomeParteEAdvogado');
      if (tipoTd) {
        const t = texto(tipoTd).replace(/[:\s]+$/g, '');
        if (t) tipoAtual = t;
      }
      if (nomeTd && tipoAtual) {
        const clone = nomeTd.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('span').forEach((span) => span.remove());
        const nome = texto(clone).replace(/^:?\s*/, '').trim();
        const advogados: string[] = [];
        const advMatches = (nomeTd.textContent || '').match(/Advogad[oa]\s*(?:\(a\))?\s*:?\s*([^\n]+)/gi);
        if (advMatches) {
          advMatches.forEach((m) => {
            const advNome = m.replace(/^Advogad[oa]\s*(?:\(a\))?\s*:?\s*/i, '').trim();
            if (advNome && !advogados.includes(advNome)) advogados.push(advNome);
          });
        }
        if (nome && !nomesVistos.has(nome)) {
          nomesVistos.add(nome);
          partes.push({ tipo: tipoAtual, nome, advogados });
        }
      }
    });
    if (partes.length > 0) return partes;
  }

  const regex = /(Reqte|Reqdo|Reqda|Autor|Autora|Réu|Ré|Exequente|Executado|Executada|Requerente|Requerido|Requerida)\s*:?\s*([^<\n]+)/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const tipo = match[1].trim();
    const nome = match[2].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (nome && nome.length > 2 && !nomesVistos.has(nome)) {
      nomesVistos.add(nome);
      partes.push({ tipo, nome, advogados: [] });
    }
  }

  return partes;
}

function extrairMovimentacoes(doc: Document): Movimentacao[] {
  const movimentacoes: Movimentacao[] = [];
  const vistos = new Set<string>();

  const adicionar = (data: string, titulo: string) => {
    const dataLimpa = data.trim();
    const tituloLimpo = titulo.trim().replace(/\s+/g, ' ');
    if (!dataLimpa || !tituloLimpo || !/\d{2}\/\d{2}\/\d{4}/.test(dataLimpa)) return;
    const chave = `${dataLimpa}::${tituloLimpo}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    movimentacoes.push({ data: dataLimpa, titulo: tituloLimpo });
  };

  const seletoresTabelas = [
    '#tabelaTodasMovimentacoes',
    '#tabelaUltimasMovimentacoes',
    '#tabelaMovimentacoes',
    '.secaoFormBody table',
    '.unj-entity-body table',
  ];

  seletoresTabelas.forEach((seletor) => {
    doc.querySelectorAll(seletor).forEach((tabela) => {
      tabela.querySelectorAll('tr').forEach((row) => {
        const cells = row.querySelectorAll('td');
        const data = texto(row.querySelector('.dataMovimentacao, .dataMovimentacaoProcesso')) || texto(cells[0]);
        const titulo =
          texto(row.querySelector('.descricaoMovimentacao, .movimentacaoProcesso')) ||
          texto(cells[2]) ||
          texto(cells[1]);
        adicionar(data, titulo);
      });
    });
  });

  if (movimentacoes.length === 0) {
    doc.querySelectorAll('[class*="moviment"], [id*="moviment"]').forEach((bloco) => {
      bloco.querySelectorAll('tr, li, div').forEach((item) => {
        const textoItem = texto(item);
        const dataMatch = textoItem.match(/\d{2}\/\d{2}\/\d{4}/);
        if (!dataMatch) return;
        const data = dataMatch[0];
        const titulo = textoItem.replace(data, '').replace(/^[\-:\s]+/, '').trim();
        adicionar(data, titulo);
      });
    });
  }

  return movimentacoes;
}

function extrairIncidentes(doc: Document, numeroProcesso: string): Incidente[] {
  const incidentes: Incidente[] = [];
  const vistos = new Set<string>();
  doc.querySelectorAll('[id*="incidente"], #incidentesProcesso, #tabelaIncidentes').forEach((section) => {
    section.querySelectorAll('a[href*="show.do"], a[href*="processo.codigo"]').forEach((link) => {
      const href = link.getAttribute('href') || '';
      const numero = normalizarNumeroProcesso(texto(link));
      if (!/\d{7}-\d{2}\.\d{4}/.test(numero) || numero === numeroProcesso || vistos.has(numero)) return;
      vistos.add(numero);
      incidentes.push({
        numero,
        classe: 'Incidente',
        assunto: '',
        dataDistribuicao: '',
        codigo: href.match(/processo\.codigo=([A-Z0-9]+)/i)?.[1],
        foro: href.match(/processo\.foro=(\d+)/i)?.[1],
        url: href.startsWith('http') ? href : `https://esaj.tjsp.jus.br${href}`,
      });
    });
  });
  return incidentes;
}

function extrairProcessosRelacionados(doc: Document, html: string, numeroProcesso: string): Incidente[] {
  const relacionados: Incidente[] = [];
  const vistos = new Set<string>([numeroProcesso]);

  doc.querySelectorAll('a[href*="show.do"], a[href*="processo.codigo"]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const numero = normalizarNumeroProcesso(texto(link));
    if (!/\d{7}-\d{2}\.\d{4}/.test(numero) || vistos.has(numero)) return;

    const parent = link.closest('table, div, tr, section, fieldset');
    const contexto = `${parent?.textContent || ''} ${parent?.id || ''} ${parent?.className || ''}`.toLowerCase();
    if (!/(cumprimento|relacionad|incidente|execu|apensad|dependente)/.test(contexto) && !/(cumprimento|relacionad|incidente|execu)/.test(html.toLowerCase())) {
      return;
    }

    vistos.add(numero);
    let classe = 'Processo Relacionado';
    if (contexto.includes('cumprimento')) classe = 'Cumprimento de sentença';
    else if (contexto.includes('execu')) classe = 'Execução';
    else if (contexto.includes('incidente')) classe = 'Incidente';

    relacionados.push({
      numero,
      classe,
      assunto: '',
      dataDistribuicao: '',
      codigo: href.match(/processo\.codigo=([A-Z0-9]+)/i)?.[1],
      foro: href.match(/processo\.foro=(\d+)/i)?.[1],
      url: href.startsWith('http') ? href : `https://esaj.tjsp.jus.br${href}`,
    });
  });

  const regexTexto = /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})\s*-?\s*(Cumprimento de senten[cç]a|Execu[cç][aã]o|Incidente)/gi;
  let match;
  while ((match = regexTexto.exec(html)) !== null) {
    const numero = match[1];
    if (vistos.has(numero)) continue;
    vistos.add(numero);
    relacionados.push({
      numero,
      classe: match[2],
      assunto: '',
      dataDistribuicao: '',
    });
  }

  return relacionados;
}
