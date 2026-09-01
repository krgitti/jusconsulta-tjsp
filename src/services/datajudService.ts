import { ProcessoTJSP, Parte, Movimentacao } from '../types/processo';
import { ResultadoBusca } from './tjspService';

/**
 * Integração com a API Pública do DataJud (CNJ).
 *
 * Substitui a necessidade de saber se um processo está tramitando no e-SAJ
 * ou no eproc: o DataJud centraliza os metadados processuais enviados por
 * todos os tribunais (Resolução CNJ 331/2020), então a consulta por número
 * funciona independentemente da migração SAJ -> eproc em curso no TJSP.
 *
 * Docs oficiais: https://datajud-wiki.cnj.jus.br/api-publica/
 * Chave pública (a mesma para todos os usuários, divulgada pelo CNJ e usada
 * por dezenas de tribunais em suas próprias páginas de dados abertos):
 */
const DATAJUD_API_KEY =
  'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

const DATAJUD_ENDPOINT = 'https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search';

// Worker próprio (Cloudflare) — não depende de proxy público compartilhado,
// que degrada/é bloqueado por abuso de terceiros (ver histórico deste arquivo).
const MEU_WORKER = (url: string) => `https://jusconsulta-proxy.krgitti80.workers.dev/?url=${encodeURIComponent(url)}`;
const DATAJUD_PROXY_PRIMARY = MEU_WORKER;
const DATAJUD_PROXY_FALLBACK = (url: string) => `https://test.cors.workers.dev/?${url}`;

export interface DataJudMovimento {
  nome: string;
  dataHora: string;
  codigo?: number;
}

export interface DataJudProcesso {
  numeroProcesso: string;
  classe?: { codigo?: number; nome?: string };
  sistema?: { codigo?: number; nome?: string };
  formato?: { codigo?: number; nome?: string };
  tribunal?: string;
  grau?: string;
  dataAjuizamento?: string;
  dataHoraUltimaAtualizacao?: string;
  orgaoJulgador?: { nome?: string; codigoMunicipioIBGE?: number };
  assuntos?: Array<{ codigo?: number; nome?: string }>;
  movimentos?: DataJudMovimento[];
  valorCausa?: number;
  partes?: Array<{ nome?: string; tipo?: string; polo?: string }>;
}

function normalizarNumeroCNJ(termo: string): string {
  return termo.replace(/\D/g, '');
}

async function postDataJud(body: Record<string, unknown>): Promise<any> {
  const payload = JSON.stringify(body);
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `APIKey ${DATAJUD_API_KEY}`,
  };

  const tentativas = [
    () =>
      fetch(DATAJUD_PROXY_PRIMARY(DATAJUD_ENDPOINT), {
        method: 'POST',
        headers,
        body: payload,
      }),
    () =>
      fetch(DATAJUD_PROXY_FALLBACK(DATAJUD_ENDPOINT), {
        method: 'POST',
        headers: { ...headers, 'x-cors-headers': JSON.stringify({ Authorization: headers.Authorization }) },
        body: payload,
      }),
  ];

  let ultimoErro: unknown;
  for (const tentar of tentativas) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);
    try {
      const resp = await tentar();
      clearTimeout(timeoutId);
      if (!resp.ok) {
        ultimoErro = new Error(`DataJud: HTTP ${resp.status}`);
        continue;
      }
      return await resp.json();
    } catch (e) {
      clearTimeout(timeoutId);
      ultimoErro = e;
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error('DataJud: falha desconhecida');
}

function mapMovimentos(movs?: DataJudMovimento[]): Movimentacao[] {
  if (!movs || movs.length === 0) return [];
  return [...movs]
    .sort((a, b) => (b.dataHora || '').localeCompare(a.dataHora || ''))
    .map((m) => ({
      data: formatarDataHora(m.dataHora),
      titulo: m.nome || '',
    }))
    .filter((m) => m.titulo);
}

function formatarDataHora(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR');
}

function mapPartes(partes?: DataJudProcesso['partes']): Parte[] {
  if (!partes || partes.length === 0) return [];
  return partes
    .filter((p) => p.nome)
    .map((p) => ({ tipo: p.polo || p.tipo || 'Parte', nome: p.nome!, advogados: [] }));
}

function converterParaProcessoTJSP(fonte: DataJudProcesso): ProcessoTJSP {
  const movimentacoes = mapMovimentos(fonte.movimentos);
  return {
    numero: formatarNumeroCNJ(fonte.numeroProcesso),
    classe: fonte.classe?.nome || '',
    assunto: (fonte.assuntos || []).map((a) => a.nome).filter(Boolean).join('; '),
    foro: fonte.orgaoJulgador?.nome || '',
    vara: fonte.orgaoJulgador?.nome || '',
    juiz: '',
    dataDistribuicao: formatarDataHora(fonte.dataAjuizamento),
    ultimaAtualizacao: movimentacoes[0]?.data || formatarDataHora(fonte.dataHoraUltimaAtualizacao),
    valorAcao: fonte.valorCausa ? fonte.valorCausa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '',
    area: fonte.classe?.nome || '',
    situacao: '',
    partes: mapPartes(fonte.partes),
    movimentacoes,
    peticoesDiversas: [],
    incidentes: [],
    processosRelacionados: [],
    outrasNumeracoes: [],
    urlOriginal: `datajud://${fonte.numeroProcesso}`,
    instancia: fonte.grau === 'G2' ? '2º Grau' : '1º Grau',
    sistema: 'datajud',
  };
}

function formatarNumeroCNJ(digits: string): string {
  if (!digits || digits.length < 20) return digits;
  const n = digits.substring(0, 7);
  const d = digits.substring(7, 9);
  const a = digits.substring(9, 13);
  const j = digits.substring(13, 14);
  const tr = digits.substring(14, 16);
  const o = digits.substring(16, 20);
  return `${n}-${d}.${a}.${j}.${tr}.${o}`;
}

/**
 * Busca um processo pelo número CNJ diretamente na base oficial do CNJ.
 * Retorna null se não encontrado (processo pode estar em segredo de justiça,
 * ainda não replicado para o DataJud, ou o número está incorreto).
 */
export async function buscarProcessoDataJud(numero: string): Promise<ProcessoTJSP | null> {
  const numeroLimpo = normalizarNumeroCNJ(numero);
  if (numeroLimpo.length < 20) return null;

  const data = await postDataJud({
    query: { match: { numeroProcesso: numeroLimpo } },
    size: 1,
  });

  const hit = data?.hits?.hits?.[0]?._source as DataJudProcesso | undefined;
  if (!hit) return null;
  return converterParaProcessoTJSP(hit);
}

/**
 * Versão "resumo" para aparecer na lista de resultados de busca, no mesmo
 * formato usado pelas buscas via e-SAJ/eproc.
 */
export async function buscarResultadoDataJud(numero: string): Promise<ResultadoBusca | null> {
  const processo = await buscarProcessoDataJud(numero);
  if (!processo) return null;
  return {
    codigo: '',
    foro: '',
    numero: processo.numero,
    classe: processo.classe,
    assunto: processo.assunto,
    foro_nome: processo.foro,
    vara: processo.vara,
    dataDistribuicao: processo.dataDistribuicao,
    urlDireta: processo.urlOriginal || '',
    instancia: processo.instancia || '1º Grau',
    sistema: 'datajud',
    origemLabel: 'DataJud · CNJ (oficial)',
  };
}

/**
 * Busca por nome de parte. O DataJud não indexa CPF/CNPJ nos campos
 * públicos pesquisáveis (LGPD) — só nome. Útil como fonte adicional, não
 * substitui a busca por nome no e-SAJ/eproc.
 */
export async function buscarPorNomeDataJud(nome: string, tamanho = 10): Promise<ResultadoBusca[]> {
  const data = await postDataJud({
    query: { match: { 'partes.nome': nome } },
    size: tamanho,
    sort: [{ dataAjuizamento: { order: 'desc' } }],
  });

  const hits = (data?.hits?.hits || []) as Array<{ _source: DataJudProcesso }>;
  return hits.map(({ _source }) => {
    const p = converterParaProcessoTJSP(_source);
    return {
      codigo: '',
      foro: '',
      numero: p.numero,
      classe: p.classe,
      assunto: p.assunto,
      foro_nome: p.foro,
      vara: p.vara,
      dataDistribuicao: p.dataDistribuicao,
      urlDireta: p.urlOriginal || '',
      instancia: p.instancia || '1º Grau',
      sistema: 'datajud',
      origemLabel: 'DataJud · CNJ (oficial)',
    };
  });
}
