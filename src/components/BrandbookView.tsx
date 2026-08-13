import React, { useState } from 'react';
import { SysEduLogo } from './SysEduLogo';
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  FolderGit, 
  FileText, 
  Calendar, 
  CheckSquare, 
  MessageSquare, 
  DollarSign, 
  TrendingUp, 
  Settings, 
  Palette, 
  Copy, 
  Check, 
  Smartphone, 
  Laptop, 
  BookOpen, 
  Compass, 
  Award, 
  ShieldCheck, 
  Zap, 
  RefreshCw, 
  Download,
  Lock,
  User,
  Heart,
  BookMarked,
  Printer,
  CreditCard,
  Briefcase,
  Layers,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  School,
  MapPin,
  ListOrdered,
  Clock,
  QrCode,
  Shield,
  Server,
  Mail,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Building2,
  Sparkles,
  Maximize2,
  Minimize2,
  HelpCircle
} from 'lucide-react';

// Generated imagery paths
import heroBannerImg from '../assets/images/sysedu_hero_banner_1786584832528.jpg';
import academicMgmtImg from '../assets/images/sysedu_academic_mgmt_1786584846649.jpg';
import financeMgmtImg from '../assets/images/sysedu_finance_mgmt_1786584863615.jpg';
import student360Img from '../assets/images/sysedu_student_360_1786663342297.jpg';
import securityCloudImg from '../assets/images/sysedu_security_cloud_1786663353598.jpg';
import analyticsKpiImg from '../assets/images/sysedu_analytics_kpi_1786663363949.jpg';

export default function BrandbookView() {
  const [activeCategory, setActiveCategory] = useState<'all' | 'vision' | 'academic' | 'tech' | 'branding'>('all');
  const [slideMode, setSlideMode] = useState<boolean>(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [copiedSvg, setCopiedSvg] = useState<string | null>(null);

  const colors = [
    {
      name: 'Azul-Marinho (Institucional / Títulos)',
      hex: '#0D1B3D',
      rgb: 'rgb(13, 27, 61)',
      use: 'Títulos principais, cabeçalhos executivos, textos de alto contraste e fundos nobres.',
      bgClass: 'bg-[#0D1B3D] text-white'
    },
    {
      name: 'Azul Primário (SysEdu Core SaaS)',
      hex: '#1E66F5',
      rgb: 'rgb(30, 102, 245)',
      use: 'Botões principais, links ativos, destaques de navegação, ícones de foco e identidade central.',
      bgClass: 'bg-[#1E66F5] text-white'
    },
    {
      name: 'Verde-Água (Sucesso & Validação)',
      hex: '#10B981',
      rgb: 'rgb(16, 185, 129)',
      use: 'Indicadores positivos, status pago/presente, taxas de aprovação e validação de assiduidade.',
      bgClass: 'bg-[#10B981] text-white'
    },
    {
      name: 'Azul Claro (Destaque Suave)',
      hex: '#7DB7FF',
      rgb: 'rgb(125, 183, 255)',
      use: 'Efeitos de foco suave, badges secundários e realces de interface.',
      bgClass: 'bg-[#7DB7FF] text-slate-900'
    },
    {
      name: 'Cinza Neutro (Tipografia de Apoio)',
      hex: '#6B7280',
      rgb: 'rgb(107, 114, 128)',
      use: 'Legendas, rótulos de campos, metadados secundários e linhas de apoio.',
      bgClass: 'bg-[#6B7280] text-white'
    },
    {
      name: 'Fundo Neutro (Off-White)',
      hex: '#F8FAFC',
      rgb: 'rgb(248, 250, 252)',
      use: 'Planos de fundo de páginas, faixas de separação e alternância de tabelas.',
      bgClass: 'bg-[#F8FAFC] border border-gray-200 text-slate-800'
    }
  ];

  const handleCopyColor = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedColor(hex);
    setTimeout(() => setCopiedColor(null), 2000);
  };

  const slidesData = [
    {
      id: 1,
      tag: "PLATAFORMA DE GESTÃO EDUCACIONAL",
      title: "Um ecossistema. Todas as escolas. Uma única visão.",
      subtitle: "ERP / SIS educacional multi-tenant em nuvem, desenhado para mantenedoras, redes de ensino e instituições que gerem múltiplas escolas sob uma única infraestrutura.",
      quote: "“Da gestão de uma escola à gestão de todo um ecossistema educacional.”",
      image: heroBannerImg,
      badge: "Abertura Institucional"
    },
    {
      id: 2,
      tag: "O CONTEXTO",
      title: "O desafio da gestão educacional em rede",
      subtitle: "Quanto maior a instituição, maior a complexidade de gerir escolas, pessoas, processos e informação.",
      items: [
        { num: "1", title: "Dados dispersos", desc: "Informação académica e administrativa fragmentada entre múltiplas unidades escolares." },
        { num: "2", title: "Cobranças manuais", desc: "Gestão manual e ineficiente de propinas e cobranças de estudantes." },
        { num: "3", title: "Assiduidade descontrolada", desc: "Falta de controlo de presença de alunos e docentes, sem regras por turno." },
        { num: "4", title: "Pautas morosas", desc: "Processo lento de elaboração, cálculo e publicação de pautas trimestrais." },
        { num: "5", title: "Falta de auditabilidade", desc: "Ausência de rasto das ações dos utilizadores em âmbito global e local." }
      ],
      badge: "Diagnóstico do Sistema"
    },
    {
      id: 3,
      tag: "A NOSSA VISÃO",
      title: "Uma infraestrutura SaaS educacional escalável",
      subtitle: "Capaz de atuar como núcleo operacional para mantenedoras e redes de ensino de qualquer dimensão.",
      items: [
        { num: "1", title: "Multi-tenant nativo", desc: "Arquitetura pronta para sustentar mantenedoras e grupos educacionais de grande porte, com isolamento de dados por instituição." },
        { num: "2", title: "Planos SaaS parametrizados", desc: "Gestão centralizada de assinaturas, com limites configuráveis de escolas, alunos, professores e turmas por plano." },
        { num: "3", title: "Multi-idioma configurável", desc: "Suporte a tradução e configuração de idioma ao nível do tenant, preparado para diferentes mercados." }
      ],
      badge: "Visão de Produto"
    },
    {
      id: 4,
      tag: "POSICIONAMENTO",
      title: "Uma plataforma de gestão e operações educacionais",
      subtitle: "Cobertura real por domínio funcional, verificada e validada no sistema.",
      grid: [
        { name: "Académico", status: "Implementado", color: "bg-emerald-500 text-white" },
        { name: "Administrativo", status: "Implementado", color: "bg-emerald-500 text-white" },
        { name: "Financeiro", status: "Implementado", color: "bg-emerald-500 text-white" },
        { name: "Pessoas", status: "Implementado", color: "bg-emerald-500 text-white" },
        { name: "Comunicação", status: "Parcial", color: "bg-amber-500 text-white" },
        { name: "Famílias", status: "Parcial", color: "bg-amber-500 text-white" },
        { name: "Documental", status: "Parcial", color: "bg-amber-500 text-white" },
        { name: "Analytics", status: "Parcial", color: "bg-amber-500 text-white" },
        { name: "Automação", status: "Parcial", color: "bg-amber-500 text-white" },
        { name: "Integrações", status: "Não existe", color: "bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300" }
      ],
      badge: "Matriz Funcional"
    },
    {
      id: 5,
      tag: "MODELO DE DADOS",
      title: "Multi-instituição, multi-escola",
      subtitle: "Centralização onde faz sentido. Autonomia onde é necessária.",
      flow: ["Mantenedora (Tenant)", "Província / Região", "Escola"],
      details: [
        "Isolamento lógico rigoroso de dados por tenant_id em todas as coleções",
        "Configuração independente por unidade (tolerâncias, logótipo, endereço, direção)",
        "Permissões diferenciadas por nível hierárquico (módulo de permissões globais)",
        "Relatórios tabulares agregados por tenant e filtráveis por escola individual"
      ],
      badge: "Arquitetura Multi-Tenant"
    },
    {
      id: 6,
      tag: "O ECOSSISTEMA",
      title: "16 módulos nativos, um único core",
      subtitle: "Cobertura de ponta a ponta das operações escolares.",
      modules: [
        "01. Dashboard Executivo", "02. Províncias / Regiões", "03. Escolas", "04. Docentes",
        "05. Estudantes", "06. Turmas", "07. Disciplinas", "08. Classes Escolares",
        "09. Calendário & Horários", "10. Pauta Geral & Avaliações", "11. Facturação & Propinas", "12. Processos de Alunos",
        "13. Biblioteca Digital", "14. Assiduidade", "15. Workflows de Tarefas", "16. Permissões & Utilizadores"
      ],
      badge: "Core Funcional"
    },
    {
      id: 7,
      tag: "FUNDAÇÃO TÉCNICA",
      title: "Core da plataforma",
      subtitle: "Componentes transversais que sustentam todos os módulos com alta robustez.",
      features: [
        { title: "Utilizadores", desc: "Criação, atribuição de papel, ativação/suspensão e reset de senha." },
        { title: "Perfis & Permissões (RBAC)", desc: "Ações granulares: visualizar, criar, editar, excluir, exportar, aprovar." },
        { title: "Workflow", desc: "Gestão de atividades pendentes com severidade e atribuição a funções." },
        { title: "Notificações", desc: "In-app e fila assíncrona de e-mails via SMTP/Gmail." },
        { title: "Auditoria", desc: "Registo de log administrativo para todas as ações operacionais." },
        { title: "Configurações", desc: "Escalas de avaliação, dados bancários/fiscais e SMTP por tenant." },
        { title: "Gestão Documental", desc: "Anexos em PDF nos processos e biblioteca digital de e-books." },
        { title: "Segurança", desc: "Autenticação Firebase e verificação de escopo por tenant_id." }
      ],
      image: securityCloudImg,
      badge: "Fundação Técnica"
    },
    {
      id: 8,
      tag: "MÓDULO ACADÉMICO",
      title: "Gestão académica ponta a ponta",
      subtitle: "Ciclo pedagógico completo e automatizado.",
      flow: ["Ano Letivo", "Classes & Turmas", "Disciplinas & Agendamento", "Avaliação Contínua", "Pauta & Resultado"],
      details: [
        "Classes Escolares: Primário, Secundário, Médio e Pré-escolar com estrutura própria.",
        "Turmas: Vinculadas a escola, docente titular e capacidade máxima definida.",
        "Disciplinas: Agendamento com salas, docentes e dias da semana.",
        "Pautas: Notas de 1º, 2º e 3º trimestre, exames, reavaliação e cálculo automático de média e situação final."
      ],
      image: academicMgmtImg,
      badge: "Ciclo Pedagógico"
    },
    {
      id: 9,
      tag: "PERFIL UNIFICADO",
      title: "Gestão do aluno — visão 360º",
      subtitle: "Centralização completa das informações do estudante.",
      categories: [
        { label: "Pessoais", desc: "Nome, foto, género, data de nascimento, BI/NIF, documento de identificação." },
        { label: "Familiares", desc: "Vínculo com encarregado, contacto e endereço." },
        { label: "Académicos", desc: "Matrícula, escola, turma, histórico de pautas, transferências e suspensões." },
        { label: "Financeiros", desc: "Plano de propina, histórico de faturas e recibos emitidos." },
        { label: "Comportamentais", desc: "Assiduidade em tempo real, crachá digital e QR Code." }
      ],
      image: student360Img,
      badge: "Student 360º"
    },
    {
      id: 10,
      tag: "MÓDULO FINANCEIRO",
      title: "Gestão financeira e faturação de propinas",
      subtitle: "Ciclo financeiro transparente e estruturado.",
      flow: ["Preçário", "Facturação", "Pagamento", "Reconciliação", "Dívida"],
      details: [
        "Preçário configurável: Taxa de propina base, multa por atraso e taxa de IVA definidas por tenant.",
        "Faturação flexível: Emissão manual/automática de faturas por período: mensal, semestral ou anual.",
        "Pagamento & reconciliação: Alteração de estado (pendente → pago), registo de data, método e número de recibo.",
        "Controlo de dívida: Monitorização de faturas em atraso e saldo devedor consolidado por escola."
      ],
      image: financeMgmtImg,
      badge: "Ciclo Financeiro"
    },
    {
      id: 11,
      tag: "RECURSOS HUMANOS",
      title: "Gestão de pessoas (docentes e colaboradores)",
      subtitle: "Governança do corpo docente e técnico.",
      items: [
        { num: "1", title: "Cadastro de Docentes", desc: "Especialidade, número de registo, data de admissão, escola alocada e turmas atribuídas." },
        { num: "2", title: "Horários & Carga Horária", desc: "Alocação de professores às disciplinas agendadas." },
        { num: "3", title: "Assiduidade por Turno", desc: "Registo diário (manhã, tarde, noite) validado contra a tolerância de cada escola." },
        { num: "4", title: "Justificativas de Ausência", desc: "Fluxo de submissão e avaliação de justificativas, com atualização de estado da falta." }
      ],
      badge: "People 360º"
    },
    {
      id: 12,
      tag: "RELACIONAMENTO",
      title: "Comunicação e relacionamento",
      subtitle: "Canais e fluxos de comunicação integrados.",
      flow: ["Escola", "Professor", "Aluno", "Encarregado"],
      details: [
        "Notificações do sistema: Emissão in-app para gestores, professores e utilizadores.",
        "Motor de e-mail assíncrono: Configuração SMTP manual ou Gmail OAuth/App Password por tenant.",
        "Fila de reenvio automático: Tabela de e-mails pendentes reprocessada para garantir entrega confiável.",
        "Comunicação com encarregados: Notificação sobre ausências e emissão de declarações."
      ],
      badge: "Comunicação Escolar"
    },
    {
      id: 13,
      tag: "EXPERIÊNCIA MULTI-PERFIL",
      title: "Portais e experiências",
      subtitle: "5 experiências dedicadas em Web SPA responsiva.",
      portals: [
        { num: "1", name: "SuperAdmin", desc: "Gestão multi-tenant, planos SaaS, aprovação de pagamentos e logs operacionais globais." },
        { num: "2", name: "Mantenedora / Tenant", desc: "Painel consolidado de rede de escolas, estatísticas globais, regiões e permissões." },
        { num: "3", name: "Diretor de Escola", desc: "Operação da unidade: turmas, pautas, assiduidade e fecho financeiro local." },
        { num: "4", name: "Professor", desc: "Turmas atribuídas, lançamento de notas e agendamento de aulas." },
        { num: "5", name: "Aluno / Encarregado", desc: "Boletim, propinas, biblioteca digital e crachá QR Code." }
      ],
      badge: "5 Experiências"
    },
    {
      id: 14,
      tag: "INTELIGÊNCIA",
      title: "Dashboards & Analytics em tempo real",
      subtitle: "Dados → informação → decisão em tempo real.",
      items: [
        { num: "SaaS", title: "SaaS Executivo", desc: "Receita recorrente mensal, contagem de tenants por estado e alertas de vencimento." },
        { num: "Operação", title: "Operação da Rede", desc: "Total de escolas, docentes, estudantes, turmas e disciplinas por instituição." },
        { num: "Presença", title: "Assiduidade", desc: "Indicador percentual de presença acumulada em tempo real." },
        { num: "Finanças", title: "Financeiro", desc: "Volume de propinas cobradas vs. pendentes / em dívida com exportação Excel/CSV." }
      ],
      image: analyticsKpiImg,
      badge: "Dashboards & Analytics"
    },
    {
      id: 15,
      tag: "EFICIÊNCIA OPERACIONAL",
      title: "Automação de processos",
      subtitle: "Menos processos manuais, maior velocidade operacional.",
      automations: [
        { title: "Fila de e-mails", desc: "Reprocessamento automático a cada 15 segundos, garantindo entrega mesmo após falhas de ligação." },
        { title: "Assiduidade", desc: "Classificação automática (presente/atrasado) por comparação entre check-in e tolerância do turno." },
        { title: "Cálculo de pautas", desc: "Apuração automática de médias trimestrais e resultado final de aprovação." },
        { title: "Regras financeiras", desc: "Aplicação automática de multas por atraso e taxas nas faturas." }
      ],
      badge: "Automação"
    },
    {
      id: 16,
      tag: "TECNOLOGIA",
      title: "Arquitetura cloud moderna",
      subtitle: "Stack tecnológico de alto desempenho e segurança.",
      stack: [
        { label: "Interface", desc: "React 18 + TypeScript — Single Page Application rápida e responsiva." },
        { label: "Dados & Autenticação", desc: "Firebase Firestore (NoSQL) + Firebase Authentication com regras de segurança." },
        { label: "Comunicação", desc: "SMTP customizado e Gmail OAuth2 / App Password com fila resiliente." },
        { label: "Ficheiros & QR", desc: "SheetJS (Excel), visualizador PDF integrado e geração/leitura de QR Code." }
      ],
      image: securityCloudImg,
      badge: "Stack Tecnológico"
    },
    {
      id: 17,
      tag: "CONFIANÇA",
      title: "Segurança e governança",
      subtitle: "Governança de dados de classe empresarial.",
      checks: [
        { label: "Autenticação", desc: "Gestão de utilizadores via Firebase Auth." },
        { label: "RBAC granular", desc: "Matriz configurável por categoria: visualizar, criar, editar, excluir, exportar, aprovar." },
        { label: "Isolamento por tenant", desc: "Segregação obrigatória de dados por tenant_id em todas as coleções." },
        { label: "Auditoria completa", desc: "Registo de log administrativo para todas as operações de gestão." },
        { label: "Soft delete", desc: "Exclusão lógica (deleted_at) em mantenedoras e escolas, sem perda de histórico." }
      ],
      badge: "Governança de Dados"
    },
    {
      id: 18,
      tag: "POR QUE ESTA PLATAFORMA",
      title: "Diferenciais competitivos",
      subtitle: "5 pilares estratégicos de diferenciação real.",
      items: [
        { num: "1", title: "Escala", desc: "Hierarquia completa Mantenedora → Região → Escola para redes de ensino." },
        { num: "2", title: "Integração", desc: "Fila de e-mails híbrida nativa e leitura de QR Code sem investimento em hardware." },
        { num: "3", title: "Experiência", desc: "Interface responsiva e rápida, com busca em tempo real em todas as tabelas." },
        { num: "4", title: "Inteligência", desc: "Tolerância de assiduidade por turno e cálculo automatizado de aprovação." },
        { num: "5", title: "Automação", desc: "Motor de pautas trimestrais com transição automática do histórico do aluno." }
      ],
      badge: "5 Pilares"
    },
    {
      id: 19,
      tag: "IMPACTO",
      title: "Benefícios por stakeholder",
      subtitle: "Um sistema, seis perspetivas complementares.",
      stakeholders: [
        { name: "Direção Institucional", desc: "Controlo centralizado da rede, governança de limites por plano e relatório financeiro consolidado." },
        { name: "Direção de Escola", desc: "Autonomia para gerir turmas, salas, professores locais e regras de tolerância." },
        { name: "Professores", desc: "Lançamento simplificado de notas e frequências, com pautas automatizadas." },
        { name: "Alunos & Encarregados", desc: "Boletim digital, propinas, crachá QR Code e leitor de e-books." },
        { name: "Financeiro", desc: "Automação de faturamento, regras de mora e recibos numerados." },
        { name: "TI / Administradores", desc: "RBAC customizável por função, sem gerir infraestrutura física." }
      ],
      badge: "Impacto por Stakeholder"
    },
    {
      id: 20,
      tag: "EVOLUÇÃO DO PRODUTO",
      title: "Roadmap de maturidade",
      subtitle: "Estado real e transparente de implementação.",
      phases: [
        { name: "Fase 1 — Digitalizar", progress: 100, desc: "Matrículas, pautas, escolas, disciplinas, biblioteca, QR Code e assiduidade.", color: "bg-emerald-600" },
        { name: "Fase 2 — Integrar", progress: 55, desc: "E-mail SMTP e Excel concluídos; roadmap para gateways bancários.", color: "bg-amber-500" },
        { name: "Fase 3 — Automatizar", progress: 55, desc: "Fila de e-mails e cálculo de pautas automáticos; cobrança em evolução.", color: "bg-amber-500" },
        { name: "Fase 4 — Inteligência", progress: 20, desc: "Dashboards ativos; roadmap para modelos preditivos de evasão.", color: "bg-blue-500" },
        { name: "Fase 5 — Ecossistema", progress: 5, desc: "Planejamento para abertura de APIs públicas para parceiros.", color: "bg-slate-400" }
      ],
      badge: "Roadmap"
    },
    {
      id: 21,
      tag: "COMERCIAL",
      title: "Modelo de negócio",
      subtitle: "Previsibilidade de receita alinhada ao crescimento de cada mantenedora.",
      items: [
        { num: "1", title: "SaaS B2B recorrente", desc: "Assinatura mensal ou anual, gerida centralmente através do portal SuperAdmin." },
        { num: "2", title: "Precificação por camadas", desc: "Planos com limites parametrizados de escolas, docentes, estudantes, turmas e disciplinas." },
        { num: "3", title: "Faturação centralizada", desc: "Histórico de pagamentos e faturas da mantenedora geridos numa única coleção." }
      ],
      badge: "Monetização SaaS"
    },
    {
      id: 22,
      tag: "FECHO INSTITUCIONAL",
      title: "Uma instituição. Múltiplas escolas. Uma única plataforma.",
      subtitle: "Uma visão consolidada de dados e uma experiência integrada para toda a comunidade educativa.",
      quote: "“Da gestão de uma escola à gestão de todo um ecossistema educacional.”",
      image: heroBannerImg,
      badge: "Visão de Futuro"
    }
  ];

  return (
    <main id="branding-root-main" className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-24 selection:bg-blue-600 selection:text-white">
      {/* Top Navigation & Mode Switcher Bar */}
      <header id="branding-header" className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-8 py-3.5 transition-all shadow-md">
        <div id="branding-header-inner" className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <SysEduLogo variant="negative" size={36} />
            <div className="h-6 w-[1px] bg-slate-800 hidden sm:block"></div>
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-400/90 hidden sm:inline-block">
              Pitch Deck & Brandbook Institucional
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap justify-center">
            {/* View Mode Switcher */}
            <button
              id="btn-toggle-presentation-mode"
              onClick={() => setSlideMode(!slideMode)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                slideMode
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {slideMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {slideMode ? 'Visualização em Grade' : 'Modo Apresentação (Slides)'}
            </button>

            {/* Category Filter Tabs (when in grid mode) */}
            {!slideMode && (
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
                <button
                  onClick={() => setActiveCategory('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeCategory === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Todos (22 Tópicos)
                </button>
                <button
                  onClick={() => setActiveCategory('vision')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeCategory === 'vision' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Visão & Estrutura
                </button>
                <button
                  onClick={() => setActiveCategory('academic')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeCategory === 'academic' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Académico & Módulos
                </button>
                <button
                  onClick={() => setActiveCategory('tech')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeCategory === 'tech' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Tecnologia & Governança
                </button>
                <button
                  onClick={() => setActiveCategory('branding')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeCategory === 'branding' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Identidade Visual
                </button>
              </div>
            )}

            <button
              onClick={() => window.print()}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
              title="Imprimir Apresentação"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================================
          SLIDE MODE (PITCH DECK INTERACTIVE SLIDE VIEWER)
         ========================================================================= */}
      {slideMode ? (
        <div id="slide-mode-container" className="max-w-6xl mx-auto px-4 py-8">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden min-h-[600px] flex flex-col justify-between">
            {/* Background Graphic Accents */}
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

            {/* Slide Header */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-6 mb-8 relative z-10">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold rounded-full uppercase tracking-wider">
                  {slidesData[currentSlideIndex].tag}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Slide {currentSlideIndex + 1} de {slidesData.length}
                </span>
              </div>
              <SysEduLogo variant="negative" size={28} />
            </div>

            {/* Slide Body Content */}
            <div className="relative z-10 my-auto">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4 leading-tight">
                {slidesData[currentSlideIndex].title}
              </h2>
              <p className="text-lg text-slate-300 font-normal leading-relaxed max-w-3xl mb-8">
                {slidesData[currentSlideIndex].subtitle}
              </p>

              {/* Dynamic Slide Content by Schema */}
              {slidesData[currentSlideIndex].image && (
                <div className="relative rounded-2xl overflow-hidden border border-slate-800 my-6 shadow-xl max-h-72">
                  <img 
                    src={slidesData[currentSlideIndex].image} 
                    alt={slidesData[currentSlideIndex].title}
                    referrerPolicy="no-referrer"
                    className="w-full h-72 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
                  <div className="absolute bottom-4 left-6 flex items-center gap-3">
                    <SysEduLogo variant="icon" size={24} />
                    <span className="text-xs font-bold text-white uppercase tracking-wider drop-shadow-md">
                      Plataforma Integrada SysEdu
                    </span>
                  </div>
                </div>
              )}

              {slidesData[currentSlideIndex].items && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                  {slidesData[currentSlideIndex].items.map((it: any, idx: number) => (
                    <div key={idx} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
                      <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 font-bold flex items-center justify-center text-sm mb-3 border border-blue-500/20">
                        {it.num}
                      </div>
                      <h4 className="font-bold text-white text-base mb-1">{it.title}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">{it.desc}</p>
                    </div>
                  ))}
                </div>
              )}

              {slidesData[currentSlideIndex].grid && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6">
                  {slidesData[currentSlideIndex].grid.map((g: any, idx: number) => (
                    <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
                      <p className="font-bold text-sm text-slate-200 mb-2">{g.name}</p>
                      <span className={`inline-block px-2.5 py-0.5 text-[11px] font-bold rounded-full ${g.color}`}>
                        {g.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {slidesData[currentSlideIndex].flow && (
                <div className="my-6">
                  <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                    {slidesData[currentSlideIndex].flow.map((step: string, idx: number) => (
                      <React.Fragment key={idx}>
                        <div className="bg-blue-600/20 border border-blue-500/30 px-4 py-2 rounded-xl text-blue-300 font-bold text-xs sm:text-sm flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center">{idx + 1}</span>
                          {step}
                        </div>
                        {idx < slidesData[currentSlideIndex].flow.length - 1 && (
                          <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  {slidesData[currentSlideIndex].details && (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                      {slidesData[currentSlideIndex].details.map((d: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300 bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {slidesData[currentSlideIndex].modules && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                  {slidesData[currentSlideIndex].modules.map((m: string, idx: number) => (
                    <div key={idx} className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3.5 hover:border-blue-500/40 transition-colors">
                      <p className="font-semibold text-xs text-slate-200">{m}</p>
                    </div>
                  ))}
                </div>
              )}

              {slidesData[currentSlideIndex].portals && (
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mt-6">
                  {slidesData[currentSlideIndex].portals.map((p: any, idx: number) => (
                    <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                      <div>
                        <span className="w-6 h-6 rounded-lg bg-blue-600/30 text-blue-400 font-bold text-xs flex items-center justify-center mb-2">
                          {p.num}
                        </span>
                        <h4 className="font-bold text-sm text-white mb-1.5">{p.name}</h4>
                        <p className="text-[11px] text-slate-400 leading-normal">{p.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {slidesData[currentSlideIndex].phases && (
                <div className="space-y-3.5 mt-6">
                  {slidesData[currentSlideIndex].phases.map((ph: any, idx: number) => (
                    <div key={idx} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-sm text-white">{ph.name}</span>
                        <span className="font-bold text-xs text-blue-400">{ph.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-2">
                        <div className={`h-2 rounded-full ${ph.color}`} style={{ width: `${ph.progress}%` }}></div>
                      </div>
                      <p className="text-xs text-slate-400">{ph.desc}</p>
                    </div>
                  ))}
                </div>
              )}

              {slidesData[currentSlideIndex].quote && (
                <div className="mt-8 border-l-4 border-teal-500 pl-4 py-1">
                  <p className="italic text-base sm:text-lg text-teal-300 font-serif">
                    {slidesData[currentSlideIndex].quote}
                  </p>
                </div>
              )}
            </div>

            {/* Slide Navigation Footer */}
            <div className="flex items-center justify-between border-t border-slate-800/80 pt-6 mt-8 relative z-10">
              <button
                onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                disabled={currentSlideIndex === 0}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-300 text-xs font-bold flex items-center gap-2 border border-slate-800 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>

              <div className="flex items-center gap-1.5 overflow-x-auto px-2 max-w-md">
                {slidesData.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlideIndex(idx)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      currentSlideIndex === idx ? 'w-6 bg-blue-500' : 'w-2 bg-slate-800 hover:bg-slate-700'
                    }`}
                    title={`Ir para slide ${idx + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={() => setCurrentSlideIndex(Math.min(slidesData.length - 1, currentSlideIndex + 1))}
                disabled={currentSlideIndex === slidesData.length - 1}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold flex items-center gap-2 border border-blue-500 transition-colors cursor-pointer shadow-md"
              >
                Próximo <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* =========================================================================
            GRID OVERVIEW MODE (FULL 22-SLIDE DECK & BRANDBOOK EXPERIENCE)
           ========================================================================= */
        <div id="grid-mode-container" className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-16">
          
          {/* HERO BANNER SECTION (SLIDE 1) */}
          <section id="section-hero" className="relative rounded-3xl overflow-hidden border border-slate-800 bg-gradient-to-br from-slate-950 via-[#0D1B3D] to-slate-950 p-8 sm:p-14 shadow-2xl">
            <div className="absolute top-0 right-0 w-full sm:w-1/2 h-full opacity-35 pointer-events-none">
              <img 
                src={heroBannerImg} 
                alt="SysEdu Ecosystem Banner" 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0D1B3D] via-[#0D1B3D]/70 to-transparent"></div>
            </div>

            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider mb-6">
                <Sparkles className="w-3.5 h-3.5" /> Plataforma de Gestão Educacional
              </div>
              <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight mb-4">
                Um ecossistema. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-teal-300 to-blue-200">
                  Todas as escolas.
                </span> <br />
                Uma única visão.
              </h1>
              <p className="text-base sm:text-lg text-slate-300 leading-relaxed mb-6 font-normal">
                ERP / SIS educacional multi-tenant em nuvem, desenhado para mantenedoras, redes de ensino e instituições que gerem múltiplas escolas sob uma única infraestrutura.
              </p>
              
              <div className="border-l-4 border-teal-400 pl-4 py-1 mb-8">
                <p className="text-sm italic text-teal-300 font-serif">
                  “Da gestão de uma escola à gestão de todo um ecossistema educacional.”
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  onClick={() => { setSlideMode(true); setCurrentSlideIndex(0); }}
                  className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all shadow-lg shadow-blue-900/30 flex items-center gap-2 cursor-pointer"
                >
                  <Maximize2 className="w-4 h-4" /> Iniciar Apresentação Interativa
                </button>
                <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/80 px-4 py-3 rounded-xl border border-slate-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Multi-Tenant • RBAC • Nuvem Firestore</span>
                </div>
              </div>
            </div>
          </section>

          {/* SLIDE 2: O CONTEXTO & DESAFIO */}
          {(activeCategory === 'all' || activeCategory === 'vision') && (
            <section id="section-context" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400">O Contexto</span>
                  <h2 className="text-2xl font-extrabold text-white tracking-tight">O desafio da gestão educacional em rede</h2>
                </div>
                <span className="text-xs text-slate-500 font-mono">Slide 02</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {[
                  { n: "1", title: "Dados dispersos", desc: "Informação académica e administrativa fragmentada entre múltiplas unidades escolares." },
                  { n: "2", title: "Cobranças manuais", desc: "Gestão manual e ineficiente de propinas e cobranças de estudantes." },
                  { n: "3", title: "Assiduidade descontrolada", desc: "Falta de controlo de presença de alunos e docentes, sem regras por turno." },
                  { n: "4", title: "Pautas morosas", desc: "Processo lento de elaboração, cálculo e publicação de pautas trimestrais." },
                  { n: "5", title: "Falta de auditabilidade", desc: "Ausência de rasto das ações dos utilizadores em âmbito global e local." }
                ].map((item, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800/90 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between">
                    <div>
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 font-black text-sm flex items-center justify-center mb-3">
                        {item.n}
                      </div>
                      <h3 className="font-bold text-white text-sm mb-1.5">{item.title}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 italic text-center">
                Quanto maior a instituição, maior a complexidade de gerir escolas, pessoas, processos e informação.
              </p>
            </section>
          )}

          {/* SLIDE 3 & 4: VISÃO & POSICIONAMENTO */}
          {(activeCategory === 'all' || activeCategory === 'vision') && (
            <section id="section-vision-positioning" className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Visão de Produto */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-400">A Nossa Visão</span>
                    <h3 className="text-xl font-black text-white mt-1">Infraestrutura SaaS Escalável</h3>
                  </div>
                  <SysEduLogo variant="icon" size={28} />
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Uma infraestrutura SaaS educacional escalável, capaz de atuar como núcleo operacional para mantenedoras e redes de ensino de qualquer dimensão.
                </p>
                <div className="space-y-3">
                  {[
                    { n: "1", t: "Multi-tenant nativo", d: "Arquitetura pronta para sustentar mantenedoras e grupos educacionais de grande porte, com isolamento de dados por instituição." },
                    { n: "2", t: "Planos SaaS parametrizados", d: "Gestão centralizada de assinaturas, com limites configuráveis de escolas, alunos, professores e turmas por plano." },
                    { n: "3", t: "Multi-idioma configurável", d: "Suporte a tradução e configuração de idioma ao nível do tenant, preparado para diferentes mercados." }
                  ].map((it, idx) => (
                    <div key={idx} className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 flex items-start gap-3">
                      <span className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {it.n}
                      </span>
                      <div>
                        <h4 className="font-bold text-xs text-white mb-0.5">{it.t}</h4>
                        <p className="text-[11px] text-slate-400">{it.d}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Posicionamento & Cobertura Real */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Posicionamento</span>
                    <h3 className="text-xl font-black text-white mt-1">Cobertura Real por Domínio</h3>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">10 Domínios</span>
                </div>
                <p className="text-xs text-slate-400">
                  Cobertura real por domínio funcional, verificada e comprovada no sistema:
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { name: "Académico", status: "Implementado", color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" },
                    { name: "Administrativo", status: "Implementado", color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" },
                    { name: "Financeiro", status: "Implementado", color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" },
                    { name: "Pessoas (RH)", status: "Implementado", color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" },
                    { name: "Comunicação", status: "Parcial", color: "bg-amber-500/10 text-amber-400 border border-amber-500/30" },
                    { name: "Famílias", status: "Parcial", color: "bg-amber-500/10 text-amber-400 border border-amber-500/30" },
                    { name: "Documental", status: "Parcial", color: "bg-amber-500/10 text-amber-400 border border-amber-500/30" },
                    { name: "Analytics", status: "Parcial", color: "bg-amber-500/10 text-amber-400 border border-amber-500/30" },
                    { name: "Automação", status: "Parcial", color: "bg-amber-500/10 text-amber-400 border border-amber-500/30" },
                    { name: "Integrações", status: "Não existe", color: "bg-slate-800 text-slate-400 border border-slate-700" }
                  ].map((dom, idx) => (
                    <div key={idx} className="bg-slate-900 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">{dom.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${dom.color}`}>
                        {dom.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* SLIDE 5: MODELO DE DADOS MULTI-INSTITUIÇÃO */}
          {(activeCategory === 'all' || activeCategory === 'vision') && (
            <section id="section-data-model" className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Modelo de Dados</span>
                  <h2 className="text-2xl font-extrabold text-white mt-1">Multi-instituição, multi-escola</h2>
                </div>
                <p className="text-xs italic text-teal-400 font-serif">“Centralização onde faz sentido. Autonomia onde é necessária.”</p>
              </div>

              {/* Hierarchy Diagram Flow */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                <div className="bg-gradient-to-br from-[#0D1B3D] to-blue-950 border border-blue-800/60 rounded-2xl p-6 text-center relative shadow-lg">
                  <Building2 className="w-8 h-8 text-blue-400 mx-auto mb-3" />
                  <h4 className="font-black text-white text-base">Mantenedora (Tenant)</h4>
                  <p className="text-xs text-blue-200/80 mt-1">Governança, Planos SaaS e Configuração Geral</p>
                  <span className="inline-block mt-3 px-2.5 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] font-mono rounded-md">tenant_id</span>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center relative">
                  <MapPin className="w-8 h-8 text-teal-400 mx-auto mb-3" />
                  <h4 className="font-black text-white text-base">Província / Região</h4>
                  <p className="text-xs text-slate-400 mt-1">Agrupamento regional e jurisdições escolares</p>
                  <span className="inline-block mt-3 px-2.5 py-0.5 bg-teal-500/20 text-teal-300 text-[10px] font-mono rounded-md">provincia_id</span>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center relative">
                  <School className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                  <h4 className="font-black text-white text-base">Escola / Unidade</h4>
                  <p className="text-xs text-slate-400 mt-1">Turmas, salas, assiduidade e regras locais</p>
                  <span className="inline-block mt-3 px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-mono rounded-md">escola_id</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  "Isolamento lógico rigoroso de dados por tenant_id em todas as coleções",
                  "Configuração independente por unidade (tolerâncias por turno, logótipo, endereço, direção)",
                  "Permissões diferenciadas por nível hierárquico (módulo de permissões globais)",
                  "Relatórios tabulares agregados por tenant e filtráveis por escola individual"
                ].map((txt, idx) => (
                  <div key={idx} className="flex items-start gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800/60">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-300 leading-relaxed">{txt}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* SLIDE 6: OS 16 MÓDULOS NATIVOS DO ECOSSISTEMA */}
          {(activeCategory === 'all' || activeCategory === 'academic') && (
            <section id="section-modules" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400">O Ecossistema</span>
                  <h2 className="text-2xl font-extrabold text-white tracking-tight">16 módulos nativos, um único core</h2>
                </div>
                <span className="text-xs text-slate-500 font-mono">Slide 06</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {[
                  { n: "01", t: "Dashboard Executivo", icon: <LayoutDashboard className="w-4 h-4 text-blue-400" /> },
                  { n: "02", t: "Províncias / Regiões", icon: <MapPin className="w-4 h-4 text-blue-400" /> },
                  { n: "03", t: "Escolas", icon: <School className="w-4 h-4 text-blue-400" /> },
                  { n: "04", t: "Docentes", icon: <Users className="w-4 h-4 text-blue-400" /> },
                  { n: "05", t: "Estudantes", icon: <GraduationCap className="w-4 h-4 text-teal-400" /> },
                  { n: "06", t: "Turmas", icon: <BookOpen className="w-4 h-4 text-teal-400" /> },
                  { n: "07", t: "Disciplinas", icon: <BookMarked className="w-4 h-4 text-teal-400" /> },
                  { n: "08", t: "Classes Escolares", icon: <ListOrdered className="w-4 h-4 text-teal-400" /> },
                  { n: "09", t: "Calendário & Horários", icon: <Calendar className="w-4 h-4 text-emerald-400" /> },
                  { n: "10", t: "Pauta Geral & Avaliações", icon: <Award className="w-4 h-4 text-emerald-400" /> },
                  { n: "11", t: "Facturação & Propinas", icon: <DollarSign className="w-4 h-4 text-emerald-400" /> },
                  { n: "12", t: "Processos de Alunos", icon: <FileText className="w-4 h-4 text-emerald-400" /> },
                  { n: "13", t: "Biblioteca Digital", icon: <BookOpen className="w-4 h-4 text-blue-300" /> },
                  { n: "14", t: "Assiduidade & QR", icon: <QrCode className="w-4 h-4 text-blue-300" /> },
                  { n: "15", t: "Workflows de Tarefas", icon: <CheckSquare className="w-4 h-4 text-blue-300" /> },
                  { n: "16", t: "Permissões & Utilizadores", icon: <Lock className="w-4 h-4 text-blue-300" /> }
                ].map((mod, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-all flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
                      {mod.icon}
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-slate-500">{mod.n}</span>
                      <h4 className="font-bold text-xs text-slate-200 leading-tight">{mod.t}</h4>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* SLIDE 7 & 8: GESTÃO ACADÉMICA & STUDENT 360 */}
          {(activeCategory === 'all' || activeCategory === 'academic') && (
            <section id="section-academic-student" className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Gestão Académica */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Módulo Académico</span>
                    <h3 className="text-xl font-black text-white mt-1">Gestão académica ponta a ponta</h3>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">Slide 08</span>
                </div>

                <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-md">
                  <img src={academicMgmtImg} alt="Academic Management" referrerPolicy="no-referrer" className="w-full h-44 object-cover" />
                </div>

                {/* Academic Flow */}
                <div className="flex items-center gap-1.5 overflow-x-auto py-2">
                  {["Ano Letivo", "Classes & Turmas", "Disciplinas", "Avaliação Contínua", "Pauta Final"].map((st, i) => (
                    <React.Fragment key={i}>
                      <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-300 rounded-lg shrink-0">
                        {st}
                      </span>
                      {i < 4 && <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />}
                    </React.Fragment>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
                    <h5 className="font-bold text-xs text-white mb-1">Classes Escolares</h5>
                    <p className="text-[11px] text-slate-400">Primário, Secundário, Médio e Pré-escolar com estrutura própria.</p>
                  </div>
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
                    <h5 className="font-bold text-xs text-white mb-1">Turmas & Salas</h5>
                    <p className="text-[11px] text-slate-400">Vinculadas a escola, docente titular e capacidade máxima.</p>
                  </div>
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
                    <h5 className="font-bold text-xs text-white mb-1">Disciplinas & Grade</h5>
                    <p className="text-[11px] text-slate-400">Agendamento com salas, docentes e dias da semana.</p>
                  </div>
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
                    <h5 className="font-bold text-xs text-white mb-1">Pautas & Resultados</h5>
                    <p className="text-[11px] text-slate-400">Trimestres, exames, reavaliação e cálculo automático de média.</p>
                  </div>
                </div>
              </div>

              {/* Student 360 */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-400">Perfil Unificado</span>
                    <h3 className="text-xl font-black text-white mt-1">Gestão do aluno — visão 360º</h3>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">Slide 09</span>
                </div>

                <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-md">
                  <img src={student360Img} alt="Student 360" referrerPolicy="no-referrer" className="w-full h-44 object-cover" />
                </div>

                <div className="space-y-2.5">
                  {[
                    { cat: "Pessoais", desc: "Nome, foto, género, data de nascimento, BI/NIF, documento de identificação." },
                    { cat: "Familiares", desc: "Vínculo com encarregado, contacto e endereço." },
                    { cat: "Académicos", desc: "Matrícula, escola, turma, histórico de pautas, transferências e suspensões." },
                    { cat: "Financeiros", desc: "Plano de propina, histórico de faturas e recibos emitidos." },
                    { cat: "Comportamentais", desc: "Assiduidade em tempo real, crachá digital e QR Code." }
                  ].map((c, idx) => (
                    <div key={idx} className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 flex items-start gap-3">
                      <span className="px-2 py-0.5 bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[10px] font-bold rounded-md uppercase tracking-wider shrink-0 mt-0.5">
                        {c.cat}
                      </span>
                      <p className="text-xs text-slate-300">{c.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* SLIDE 10 & 11: FINANCEIRO & RECURSOS HUMANOS */}
          {(activeCategory === 'all' || activeCategory === 'academic') && (
            <section id="section-finance-rh" className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Financeiro */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Módulo Financeiro</span>
                    <h3 className="text-xl font-black text-white mt-1">Gestão financeira e faturação</h3>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">Slide 10</span>
                </div>

                <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-md">
                  <img src={financeMgmtImg} alt="Finance Management" referrerPolicy="no-referrer" className="w-full h-44 object-cover" />
                </div>

                {/* Finance Flow */}
                <div className="flex items-center gap-1.5 overflow-x-auto py-2">
                  {["Preçário", "Facturação", "Pagamento", "Reconciliação", "Dívida"].map((st, i) => (
                    <React.Fragment key={i}>
                      <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-300 rounded-lg shrink-0">
                        {st}
                      </span>
                      {i < 4 && <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />}
                    </React.Fragment>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
                    <h5 className="font-bold text-xs text-white mb-1">Preçário Configurável</h5>
                    <p className="text-[11px] text-slate-400">Propina base, multa por atraso e taxa de IVA por tenant.</p>
                  </div>
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
                    <h5 className="font-bold text-xs text-white mb-1">Faturação Flexível</h5>
                    <p className="text-[11px] text-slate-400">Emissão por período: mensal, semestral ou anual.</p>
                  </div>
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
                    <h5 className="font-bold text-xs text-white mb-1">Pagamento & Recibo</h5>
                    <p className="text-[11px] text-slate-400">Estado (pendente → pago), método e número de recibo.</p>
                  </div>
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
                    <h5 className="font-bold text-xs text-white mb-1">Controlo de Dívida</h5>
                    <p className="text-[11px] text-slate-400">Faturas em atraso e saldo devedor consolidado.</p>
                  </div>
                </div>
              </div>

              {/* Recursos Humanos */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Recursos Humanos</span>
                    <h3 className="text-xl font-black text-white mt-1">Gestão de pessoas (docentes e colaboradores)</h3>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">Slide 11</span>
                </div>

                <div className="space-y-3.5">
                  {[
                    { n: "1", title: "Cadastro de Docentes", desc: "Especialidade, número de registo, data de admissão, escola alocada e turmas atribuídas." },
                    { n: "2", title: "Horários & Carga Horária", desc: "Alocação de professores às disciplinas agendadas e controle de salas." },
                    { n: "3", title: "Assiduidade por Turno", desc: "Registo diário (manhã, tarde, noite) validado contra a tolerância de cada escola." },
                    { n: "4", title: "Justificativas de Ausência", desc: "Fluxo de submissão e avaliação de justificativas, com atualização de estado da falta." }
                  ].map((rh, idx) => (
                    <div key={idx} className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 flex items-start gap-3">
                      <span className="w-7 h-7 rounded-xl bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {rh.n}
                      </span>
                      <div>
                        <h4 className="font-bold text-xs text-white mb-0.5">{rh.title}</h4>
                        <p className="text-[11px] text-slate-400">{rh.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* SLIDE 13 & 14: PORTAIS & DASHBOARDS */}
          {(activeCategory === 'all' || activeCategory === 'tech') && (
            <section id="section-portals-dashboards" className="space-y-6">
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-8">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-400">Experiência Multi-Perfil</span>
                  <h2 className="text-2xl font-extrabold text-white mt-1">5 Portais e experiências dedicadas</h2>
                  <p className="text-xs text-slate-400 mt-1">Web SPA responsiva — adaptada a cada perfil com alta fidelidade.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3.5">
                  {[
                    { n: "1", role: "SuperAdmin", desc: "Gestão multi-tenant, planos SaaS, aprovação de pagamentos e logs operacionais globais." },
                    { n: "2", role: "Mantenedora / Tenant", desc: "Painel consolidado de rede de escolas, estatísticas globais, regiões e permissões." },
                    { n: "3", role: "Diretor de Escola", desc: "Operação da unidade: turmas, pautas, assiduidade e fecho financeiro local." },
                    { n: "4", role: "Professor", desc: "Turmas atribuídas, lançamento de notas e agendamento de aulas." },
                    { n: "5", role: "Aluno / Encarregado", desc: "Boletim, propinas, biblioteca digital e crachá QR Code." }
                  ].map((p, idx) => (
                    <div key={idx} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                      <div>
                        <span className="w-6 h-6 rounded-lg bg-blue-600/30 text-blue-400 font-bold text-xs flex items-center justify-center mb-3">
                          {p.n}
                        </span>
                        <h4 className="font-bold text-sm text-white mb-1.5">{p.role}</h4>
                        <p className="text-[11px] text-slate-400 leading-normal">{p.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-800/80 pt-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                    <div className="lg:col-span-2 space-y-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Inteligência & Analytics</span>
                      <h3 className="text-xl font-black text-white">Dashboards & Analytics em tempo real</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase font-mono">SaaS</p>
                          <p className="text-xs font-bold text-white mt-1">MRR & Tenants</p>
                        </div>
                        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase font-mono">Operação</p>
                          <p className="text-xs font-bold text-white mt-1">Escolas & Alunos</p>
                        </div>
                        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase font-mono">Presença</p>
                          <p className="text-xs font-bold text-white mt-1">Assiduidade Real</p>
                        </div>
                        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                          <p className="text-[10px] text-slate-500 uppercase font-mono">Finanças</p>
                          <p className="text-xs font-bold text-white mt-1">Propinas & Dívida</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-lg">
                      <img src={analyticsKpiImg} alt="Analytics KPI" referrerPolicy="no-referrer" className="w-full h-36 object-cover" />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* SLIDE 16 & 17: TECNOLOGIA & SEGURANÇA */}
          {(activeCategory === 'all' || activeCategory === 'tech') && (
            <section id="section-tech-security" className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Tecnologia */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Tecnologia</span>
                    <h3 className="text-xl font-black text-white mt-1">Arquitetura cloud moderna</h3>
                  </div>
                  <Server className="w-5 h-5 text-blue-400" />
                </div>

                <div className="space-y-3">
                  {[
                    { l: "Interface", d: "React 18 + TypeScript — Single Page Application", i: <Laptop className="w-4 h-4 text-blue-400" /> },
                    { l: "Dados & Autenticação", d: "Firebase Firestore (NoSQL) + Firebase Authentication", i: <Server className="w-4 h-4 text-teal-400" /> },
                    { l: "Comunicação", d: "SMTP customizado e Gmail OAuth2 / App Password", i: <Mail className="w-4 h-4 text-amber-400" /> },
                    { l: "Ficheiros & QR", d: "SheetJS (Excel), visualizador PDF e geração/leitura de QR Code", i: <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> }
                  ].map((st, idx) => (
                    <div key={idx} className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
                        {st.i}
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-white mb-0.5">{st.l}</h4>
                        <p className="text-[11px] text-slate-400">{st.d}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Segurança e Governança */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Confiança</span>
                    <h3 className="text-xl font-black text-white mt-1">Segurança e governança</h3>
                  </div>
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>

                <div className="space-y-2.5">
                  {[
                    { label: "Autenticação", desc: "Gestão de utilizadores via Firebase Auth." },
                    { label: "RBAC granular", desc: "Matriz configurável por categoria: visualizar, criar, editar, excluir, exportar, aprovar." },
                    { label: "Isolamento por tenant", desc: "Segregação obrigatória de dados por tenant_id em todas as coleções." },
                    { label: "Auditoria completa", desc: "Registo de log administrativo para todas as operações de gestão." },
                    { label: "Soft delete", desc: "Exclusão lógica (deleted_at) em mantenedoras e escolas, sem perda de histórico." }
                  ].map((sec, idx) => (
                    <div key={idx} className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80 flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-bold text-white mr-1.5">{sec.label}:</span>
                        <span className="text-xs text-slate-400">{sec.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* SLIDE 18 & 19: DIFERENCIAIS & STAKEHOLDERS */}
          {(activeCategory === 'all' || activeCategory === 'vision') && (
            <section id="section-differentials-stakeholders" className="space-y-8">
              {/* Diferenciais Competitivos */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Por Que Esta Plataforma</span>
                    <h2 className="text-2xl font-extrabold text-white mt-1">Diferenciais competitivos</h2>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">5 Pilares</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3.5">
                  {[
                    { n: "1", p: "Escala", d: "Hierarquia completa Mantenedora → Região → Escola para redes de ensino." },
                    { n: "2", p: "Integração", d: "Fila de e-mails híbrida nativa e leitura de QR Code sem investimento em hardware." },
                    { n: "3", p: "Experiência", d: "Interface responsiva e rápida, com busca em tempo real em todas as tabelas." },
                    { n: "4", p: "Inteligência", d: "Tolerância de assiduidade por turno e cálculo automatizado de aprovação." },
                    { n: "5", p: "Automação", d: "Motor de pautas trimestrais com transição automática do histórico do aluno." }
                  ].map((pil, idx) => (
                    <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                      <div>
                        <span className="w-7 h-7 rounded-xl bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center mb-3">
                          {pil.n}
                        </span>
                        <h4 className="font-bold text-sm text-white mb-1.5">{pil.p}</h4>
                        <p className="text-[11px] text-slate-400 leading-normal">{pil.d}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Benefícios por Stakeholder */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-400">Impacto</span>
                    <h2 className="text-2xl font-extrabold text-white mt-1">Benefícios por stakeholder</h2>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">6 Perspetivas</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { s: "Direção Institucional", d: "Controlo centralizado da rede, governança de limites por plano e relatório financeiro consolidado." },
                    { s: "Direção de Escola", d: "Autonomia para gerir turmas, salas, professores locais e regras de tolerância." },
                    { s: "Professores", d: "Lançamento simplificado de notas e frequências, com pautas automatizadas." },
                    { s: "Alunos & Encarregados", d: "Boletim digital, propinas, crachá QR Code e leitor de e-books." },
                    { s: "Financeiro", d: "Automação de faturamento, regras de mora e recibos numerados." },
                    { s: "TI / Administradores", d: "RBAC customizável por função, sem gerir infraestrutura física." }
                  ].map((st, idx) => (
                    <div key={idx} className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4">
                      <h4 className="font-bold text-xs text-teal-300 mb-1.5 flex items-center gap-2">
                        <User className="w-3.5 h-3.5" /> {st.s}
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed">{st.d}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* SLIDE 20 & 21: ROADMAP DE MATURIDADE & MODELO DE NEGÓCIO */}
          {(activeCategory === 'all' || activeCategory === 'tech') && (
            <section id="section-roadmap-business" className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Roadmap */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Evolução do Produto</span>
                    <h3 className="text-xl font-black text-white mt-1">Roadmap de maturidade</h3>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">Estado Real</span>
                </div>

                <div className="space-y-4">
                  {[
                    { f: "Fase 1 — Digitalizar", p: 100, d: "Matrículas, pautas, escolas, disciplinas, biblioteca, QR Code e assiduidade.", c: "bg-emerald-500" },
                    { f: "Fase 2 — Integrar", p: 55, d: "E-mail SMTP e Excel concluídos; falta integração com gateways bancários.", c: "bg-amber-500" },
                    { f: "Fase 3 — Automatizar", p: 55, d: "Fila de e-mails e cálculo de pautas automáticos; falta automação de cobranças.", c: "bg-amber-500" },
                    { f: "Fase 4 — Inteligência", p: 20, d: "Dashboards ativos; faltam modelos preditivos de evasão escolar.", c: "bg-blue-500" },
                    { f: "Fase 5 — Ecossistema", p: 5, d: "Ausência de API pública aberta para integrações de terceiros.", c: "bg-slate-600" }
                  ].map((phase, idx) => (
                    <div key={idx} className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="font-bold text-xs text-white">{phase.f}</span>
                        <span className="font-mono text-xs font-bold text-slate-300">{phase.p}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-2">
                        <div className={`h-2 rounded-full ${phase.c}`} style={{ width: `${phase.p}%` }}></div>
                      </div>
                      <p className="text-[11px] text-slate-400">{phase.d}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modelo de Negócio */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Comercial</span>
                    <h3 className="text-xl font-black text-white mt-1">Modelo de negócio SaaS</h3>
                  </div>
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                </div>

                <div className="space-y-3.5">
                  {[
                    { n: "1", t: "SaaS B2B recorrente", d: "Assinatura mensal ou anual, gerida centralmente através do portal SuperAdmin com ativação instantânea." },
                    { n: "2", t: "Precificação por camadas", d: "Planos com limites parametrizados de escolas, docentes, estudantes, turmas e disciplinas para atender desde escolas individuais a redes nacionais." },
                    { n: "3", t: "Faturação centralizada", d: "Histórico de pagamentos e faturas da mantenedora geridos numa única coleção com comprovativo e controle de renovação." }
                  ].map((bn, idx) => (
                    <div key={idx} className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 flex items-start gap-3">
                      <span className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {bn.n}
                      </span>
                      <div>
                        <h4 className="font-bold text-xs text-white mb-0.5">{bn.t}</h4>
                        <p className="text-[11px] text-slate-400">{bn.d}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 text-center">
                  <p className="text-xs italic text-slate-300 font-serif">
                    “Previsibilidade de receita alinhada ao crescimento de cada mantenedora.”
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* SLIDE 22: FECHO INSTITUCIONAL */}
          {(activeCategory === 'all' || activeCategory === 'vision') && (
            <section id="section-closing" className="bg-gradient-to-r from-[#0D1B3D] via-slate-950 to-[#0D1B3D] border border-blue-800/40 rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl">
              <div className="max-w-2xl mx-auto space-y-4 relative z-10">
                <SysEduLogo variant="negative" size={48} />
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-4">
                  Uma instituição. Múltiplas escolas. <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">
                    Uma única plataforma.
                  </span>
                </h2>
                <p className="text-sm sm:text-base text-slate-300 font-normal">
                  Uma visão consolidada de dados e uma experiência integrada para toda a comunidade educativa.
                </p>
                <p className="text-sm italic text-teal-300 font-serif pt-2">
                  “Da gestão de uma escola à gestão de todo um ecossistema educacional.”
                </p>
              </div>
            </section>
          )}

          {/* =========================================================================
              GUIA DE MARCA & ASSETS VISUAIS (BRANDBOOK COMPLETO)
             ========================================================================= */}
          {(activeCategory === 'all' || activeCategory === 'branding') && (
            <section id="section-brandbook-assets" className="space-y-8 pt-8 border-t border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Guia de Marca</span>
                  <h2 className="text-2xl font-extrabold text-white">Identidade Visual & Assets Oficiais</h2>
                </div>
                <span className="text-xs text-slate-400">Diretrizes de Aplicação SysEdu</span>
              </div>

              {/* Logo Showcase Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Horizontal Standard */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 text-slate-900 shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4 block">Versão Principal (Full)</span>
                  <div className="py-4 flex items-center justify-center">
                    <SysEduLogo variant="full" size={36} />
                  </div>
                  <span className="text-[11px] text-slate-500 text-center">Fundo Claro / Documentos</span>
                </div>

                {/* Negative Dark */}
                <div className="bg-[#0D1B3D] rounded-2xl p-6 border border-blue-900/60 text-white shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300/60 mb-4 block">Versão Negativa (Dark)</span>
                  <div className="py-4 flex items-center justify-center">
                    <SysEduLogo variant="negative" size={36} />
                  </div>
                  <span className="text-[11px] text-blue-200/60 text-center">Fundo Escuro / Menus</span>
                </div>

                {/* Vertical */}
                <div className="bg-slate-950 rounded-2xl p-6 border border-slate-800 text-white shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-4 block">Versão Vertical</span>
                  <div className="py-2 flex items-center justify-center">
                    <SysEduLogo variant="vertical" size={36} />
                  </div>
                  <span className="text-[11px] text-slate-400 text-center">Crachás / Banners</span>
                </div>

                {/* Monocromática */}
                <div className="bg-slate-100 rounded-2xl p-6 border border-slate-200 text-slate-800 shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-4 block">Monocromática</span>
                  <div className="py-4 flex items-center justify-center">
                    <SysEduLogo variant="monochrome" size={36} />
                  </div>
                  <span className="text-[11px] text-slate-500 text-center">Impressão / Preto e Branco</span>
                </div>
              </div>

              {/* Color Palette Grid */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <h3 className="text-lg font-black text-white">Paleta Cromática Oficial</h3>
                  <span className="text-xs text-slate-400">Clique para copiar o HEX</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {colors.map((col, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleCopyColor(col.hex)}
                      className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 hover:border-slate-700 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-xl ${col.bgClass} shadow-md shrink-0 flex items-center justify-center font-bold text-xs`}>
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-white leading-tight">{col.name}</h4>
                          <span className="text-[11px] font-mono text-slate-400">{col.hex}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-normal">{col.use}</p>
                      <div className="mt-2 text-right">
                        <span className="text-[10px] font-semibold text-blue-400 group-hover:underline inline-flex items-center gap-1">
                          {copiedColor === col.hex ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedColor === col.hex ? 'Copiado!' : 'Copiar HEX'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

        </div>
      )}
    </main>
  );
}
