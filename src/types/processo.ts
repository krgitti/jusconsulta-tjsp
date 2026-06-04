export interface Movimentacao {
  data: string;
  titulo: string;
}

export interface Parte {
  tipo: string;
  nome: string;
  advogados: string[];
}

export interface Peticao {
  data: string;
  tipo: string;
}

export interface Incidente {
  numero: string;
  classe: string;
  assunto: string;
  dataDistribuicao: string;
  codigo?: string;
  foro?: string;
  url?: string;
}

export interface DocumentoProcesso {
  titulo: string;
  data: string;
  tipo: string;
  url?: string;
}

export interface ProcessoTJSP {
  numero: string;
  classe: string;
  assunto: string;
  foro: string;
  vara: string;
  juiz: string;
  dataDistribuicao: string;
  ultimaAtualizacao: string;
  valorAcao: string;
  area: string;
  situacao: string;
  partes: Parte[];
  movimentacoes: Movimentacao[];
  peticoesDiversas: Peticao[];
  incidentes: Incidente[];
  processosRelacionados: Incidente[];
  outrasNumeracoes: string[];
  urlOriginal?: string;
  codigoProcesso?: string;
  foroProcesso?: string;
  acessoAutos?: 'publico' | 'senha' | 'certificado' | 'indisponivel';
  urlAutos?: string;
  instancia?: string;
  sistema?: string;
}
