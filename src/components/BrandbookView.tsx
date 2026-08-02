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
  ArrowRight
} from 'lucide-react';

export default function BrandbookView() {
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [copiedSvg, setCopiedSvg] = useState<string | null>(null);

  const colors = [
    {
      name: 'Fundo Principal (Branco)',
      hex: '#FFFFFF',
      rgb: 'rgb(255, 255, 255)',
      use: 'Telas, cards, fundos de formulários e espaços vazios.',
      bgClass: 'bg-[#FFFFFF] border border-gray-200'
    },
    {
      name: 'Fundo Secundário (Off-White)',
      hex: '#F8FAFC',
      rgb: 'rgb(248, 250, 252)',
      use: 'Planos de fundo de páginas, faixas de separação e alternância de tabelas.',
      bgClass: 'bg-[#F8FAFC] border border-gray-200'
    },
    {
      name: 'Azul-Marinho (Texto e Título)',
      hex: '#0D1B3D',
      rgb: 'rgb(13, 27, 61)',
      use: 'Títulos principais, cabeçalhos de alta importância, corpo de texto principal e contraste forte.',
      bgClass: 'bg-[#0D1B3D] text-white'
    },
    {
      name: 'Azul Primário (SaaS Principal)',
      hex: '#1E66F5',
      rgb: 'rgb(30, 102, 245)',
      use: 'Botões principais, links ativos, destaques de navegação e identidade primária.',
      bgClass: 'bg-[#1E66F5] text-white'
    },
    {
      name: 'Azul Claro (Destaque Suave)',
      hex: '#7DB7FF',
      rgb: 'rgb(125, 183, 255)',
      use: 'Efeitos de hover em botões secundários, bordas ativas suaves e badges.',
      bgClass: 'bg-[#7DB7FF] text-slate-900'
    },
    {
      name: 'Verde-Água (Sucesso/Aprovado)',
      hex: '#10B981',
      rgb: 'rgb(16, 185, 129)',
      use: 'Indicadores positivos, status ativo/pago, taxas crescentes e botões de finalização com sucesso.',
      bgClass: 'bg-[#10B981] text-white'
    },
    {
      name: 'Cinza Neutro (Secundário)',
      hex: '#6B7280',
      rgb: 'rgb(107, 114, 128)',
      use: 'Legendas, rótulos (labels), subtítulos secundários e ícones não-selecionados.',
      bgClass: 'bg-[#6B7280] text-white'
    },
    {
      name: 'Bordas & Divisores',
      hex: '#E5E7EB',
      rgb: 'rgb(229, 231, 235)',
      use: 'Bordas de cards, linhas divisórias finas e contorno de campos de formulário.',
      bgClass: 'bg-[#E5E7EB] border border-gray-300 text-slate-800'
    }
  ];

  const brandAttributes = [
    {
      title: 'Moderno',
      icon: <Zap className="w-5 h-5 text-[#1E66F5]" />,
      desc: 'Reflete tecnologia educacional de ponta, com fluxo SaaS rápido e visual limpo adaptado aos novos tempos.'
    },
    {
      title: 'Confiável',
      icon: <ShieldCheck className="w-5 h-5 text-[#1E66F5]" />,
      desc: 'Segurança absoluta para dados escolares e financeiros. Uma infraestrutura robusta, clara e estável.'
    },
    {
      title: 'Intuitivo',
      icon: <Compass className="w-5 h-5 text-[#1E66F5]" />,
      desc: 'Curva de aprendizado mínima. Menus limpos, ações fáceis e acessibilidade total para toda a comunidade.'
    },
    {
      title: 'Completo',
      icon: <Award className="w-5 h-5 text-[#1E66F5]" />,
      desc: 'Da gestão de salas de aula ao faturamento de propinas e relatórios financeiros superadmins na mesma plataforma.'
    },
    {
      title: 'Transformador',
      icon: <Layers className="w-5 h-5 text-[#1E66F5]" />,
      desc: 'Foco no progresso real de alunos e docentes. Automatização que libera tempo para o que realmente importa: educar.'
    }
  ];

  const outlineIconsList = [
    { label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5 text-[#1E66F5]" /> },
    { label: 'Alunos', icon: <GraduationCap className="w-5 h-5 text-[#1E66F5]" /> },
    { label: 'Professores', icon: <Users className="w-5 h-5 text-[#1E66F5]" /> },
    { label: 'Turmas', icon: <FolderGit className="w-5 h-5 text-[#1E66F5]" /> },
    { label: 'Matrículas', icon: <FileText className="w-5 h-5 text-[#1E66F5]" /> },
    { label: 'Frequência', icon: <CheckSquare className="w-5 h-5 text-[#1E66F5]" /> },
    { label: 'Avaliações', icon: <Award className="w-5 h-5 text-[#1E66F5]" /> },
    { label: 'Notas', icon: <BookOpen className="w-5 h-5 text-[#1E66F5]" /> },
    { label: 'Mensagens', icon: <MessageSquare className="w-5 h-5 text-[#1E66F5]" /> },
    { label: 'Financeiro', icon: <DollarSign className="w-5 h-5 text-[#1E66F5]" /> },
    { label: 'Relatórios', icon: <TrendingUp className="w-5 h-5 text-[#1E66F5]" /> },
    { label: 'Configurações', icon: <Settings className="w-5 h-5 text-[#1E66F5]" /> }
  ];

  const handleCopyColor = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedColor(hex);
    setTimeout(() => setCopiedColor(null), 1500);
  };

  const copySvgText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSvg(id);
    setTimeout(() => setCopiedSvg(null), 1500);
  };

  return (
    <div className="bg-slate-50 min-h-screen text-[#0D1B3D] font-poppins pb-24 selection:bg-[#7DB7FF] selection:text-[#0D1B3D]">
      {/* BRANDBOOK COVER HERO */}
      <section className="bg-white border-b border-[#E5E7EB] pt-12 pb-16 px-4 md:px-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-gradient-to-br from-[#1E66F5]/5 to-[#10B981]/5 rounded-full blur-3xl -z-10"></div>
        <div className="absolute left-10 bottom-0 w-80 h-80 bg-gradient-to-tr from-[#7DB7FF]/5 to-[#10B981]/5 rounded-full blur-3xl -z-10"></div>
        
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="space-y-4 max-w-2xl text-left">
            <span className="bg-[#1E66F5]/10 text-[#1E66F5] text-xs font-extrabold px-3 py-1.5 rounded-full uppercase tracking-wider">
              Brand Identity & Style Guide
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-[#0D1B3D] tracking-tight leading-tight">
              SysEdu Brandbook
            </h1>
            <p className="text-[#6B7280] text-sm md:text-base leading-relaxed">
              Manual de identidade visual e guia de estilo completo do ecossistema educacional de alta performance. 
              Criado para garantir a consistência estética e a sofisticação da experiência SaaS clara, amigável e transformadora do SysEdu.
            </p>
            <div className="flex flex-wrap gap-3.5 pt-2">
              <a 
                href="#logo-section" 
                className="bg-[#1E66F5] hover:bg-[#1E66F5]/90 text-white font-bold text-xs py-3 px-5 rounded-xl transition-all shadow-lg shadow-[#1E66F5]/20 flex items-center gap-1.5"
              >
                Logotipo <ArrowRight className="w-4 h-4" />
              </a>
              <a 
                href="#mockup-section" 
                className="bg-white border border-[#E5E7EB] hover:bg-slate-50 text-[#0D1B3D] font-bold text-xs py-3 px-5 rounded-xl transition-all shadow-sm"
              >
                Mockups de Aplicação
              </a>
            </div>
          </div>

          <div className="bg-slate-50 p-8 rounded-3xl border border-[#E5E7EB] shadow-xl flex items-center justify-center min-w-[280px]">
            <SysEduLogo variant="vertical" size={130} showSlogan={true} />
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 md:px-8 mt-12 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* BRANDBOOK NAVIGATION SIDEBAR */}
        <aside className="lg:col-span-1 space-y-3 lg:sticky lg:top-8 h-fit">
          <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm space-y-4">
            <h3 className="font-extrabold text-xs text-[#0D1B3D] uppercase tracking-wider">
              Sumário de Seções
            </h3>
            <nav className="flex flex-col space-y-1">
              {[
                { label: '1. O Logotipo Oficial', id: 'logo-section' },
                { label: '2. Paleta de Cores', id: 'color-section' },
                { label: '3. Tipografia Oficial', id: 'typography-section' },
                { label: '4. Ícones Corporativos', id: 'icons-section' },
                { label: '5. Variações da Marca', id: 'variations-section' },
                { label: '6. Aplicação Digital (SaaS)', id: 'mockup-section' },
                { label: '7. Aplicações Físicas', id: 'physical-section' },
                { label: '8. Atributos Fundamentais', id: 'attributes-section' }
              ].map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="text-xs font-semibold text-[#6B7280] hover:text-[#1E66F5] hover:bg-[#1E66F5]/5 px-3 py-2.5 rounded-lg transition-all flex items-center justify-between group"
                >
                  <span>{item.label}</span>
                  <span className="opacity-0 group-hover:opacity-100 text-[#1E66F5] transition-opacity">→</span>
                </a>
              ))}
            </nav>
          </div>

          {/* Quick Stats Banner */}
          <div className="bg-gradient-to-br from-[#0D1B3D] to-[#1E66F5] p-5 rounded-2xl text-white shadow-lg space-y-2.5">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#7DB7FF]">Slogan Corporativo</p>
            <p className="text-sm font-semibold italic">"Organizar hoje, transformar o amanhã."</p>
            <div className="border-t border-white/10 pt-2.5 mt-2 flex items-center gap-1.5 text-[10px] text-blue-200">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
              <span>Tema Claro Padrão Homologado</span>
            </div>
          </div>
        </aside>

        {/* BRANDBOOK CONTENT SECTIONS */}
        <main className="lg:col-span-3 space-y-12">
          
          {/* SECTION 1: LOGOTIPO OFICIAL */}
          <section id="logo-section" className="bg-white p-6 md:p-8 rounded-3xl border border-[#E5E7EB] shadow-sm space-y-6">
            <div className="border-b border-[#E5E7EB] pb-4 flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-[#1E66F5] uppercase tracking-wider font-mono">Seção 01</span>
                <h2 className="text-xl md:text-2xl font-black text-[#0D1B3D]">O Logotipo Oficial</h2>
              </div>
            </div>

            <p className="text-xs text-[#6B7280] leading-relaxed">
              O logotipo do SysEdu é composto por um ícone integrado de um <strong>chapéu de formatura (mural board cap)</strong> com um pingente sofisticado, posicionado dinamicamente sobre um <strong>livro aberto</strong>. O livro aberto apresenta uma metade em gradiente azul vibrante e a outra metade em verde-água energético, ilustrando a transição do conhecimento tradicional para a modernidade digital da gestão educacional de alto nível.
            </p>

            {/* Display of Horizontal and Vertical variants */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-[#E5E7EB]">
              
              <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] flex flex-col items-center justify-between min-h-[180px] space-y-4">
                <span className="text-[9px] font-bold text-[#6B7280] uppercase tracking-wider">Assinatura Horizontal (Preferencial)</span>
                <div className="py-2.5">
                  <SysEduLogo variant="full" size={48} showSlogan={false} />
                </div>
                <p className="text-[10px] text-[#6B7280] text-center">Para cabeçalhos de sistemas, sites corporativos, papéis timbrados e mídias amplas.</p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] flex flex-col items-center justify-between min-h-[180px] space-y-4">
                <span className="text-[9px] font-bold text-[#6B7280] uppercase tracking-wider">Assinatura Vertical (Iconográfica)</span>
                <div className="py-1">
                  <SysEduLogo variant="vertical" size={54} showSlogan={false} />
                </div>
                <p className="text-[10px] text-[#6B7280] text-center">Para materiais de marketing, capas de manuais, brindes e crachás de identificação.</p>
              </div>

            </div>

            {/* SVG Code Export Option */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0D1B3D]">Elemento de Código (SVG Vetorial)</h4>
                <button
                  onClick={() => copySvgText('logo-svg', `<svg viewBox="0 0 160 160" width="100" height="100"><path d="M 80,30 L 138,52 L 80,74 L 22,52 Z" fill="#1E66F5"/><path d="M 45,60 L 45,78 C 45,95 115,95 115,78 L 115,60" fill="#1E66F5"/><circle cx="80" cy="80" r="14" fill="#1E66F5"/><path d="M 80,105 C 55,90 28,100 24,115 L 24,142 C 28,127 55,117 80,132 Z" fill="#1E66F5"/><path d="M 80,105 C 105,90 132,100 136,115 L 136,142 C 132,127 105,117 80,132 Z" fill="#10B981"/></svg>`)}
                  className="text-[10px] text-[#1E66F5] hover:text-[#1E66F5]/80 font-bold flex items-center gap-1 cursor-pointer"
                >
                  {copiedSvg === 'logo-svg' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" /> Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copiar Código SVG
                    </>
                  )}
                </button>
              </div>
              <div className="bg-[#0D1B3D] text-[#7DB7FF] p-3 rounded-xl font-mono text-[9px] overflow-x-auto whitespace-pre">
                {`<!-- Logo SysEdu: Chapéu de Formatura & Livro Aberto -->
<svg viewBox="0 0 160 160" width="80" height="80">
  <path d="M 80,30 L 138,52 L 80,74 L 22,52 Z" fill="#1E66F5" />
  <path d="M 45,60 L 45,78 C 45,95 115,95 115,78 L 115,60" fill="#1E66F5" />
  <path d="M 80,105 C 55,90 28,100 24,115 L 24,142 Z" fill="#1E66F5" />
  <path d="M 80,105 C 105,90 132,100 136,115 L 136,142 Z" fill="#10B981" />
</svg>`}
              </div>
            </div>
          </section>

          {/* SECTION 2: PALETA DE CORES (TEMA CLARO) */}
          <section id="color-section" className="bg-white p-6 md:p-8 rounded-3xl border border-[#E5E7EB] shadow-sm space-y-6">
            <div className="border-b border-[#E5E7EB] pb-4">
              <span className="text-[10px] font-black text-[#1E66F5] uppercase tracking-wider font-mono">Seção 02</span>
              <h2 className="text-xl md:text-2xl font-black text-[#0D1B3D]">Paleta de Cores Oficial</h2>
            </div>

            <p className="text-xs text-[#6B7280] leading-relaxed">
              O ecossistema visual do SysEdu foi migrado inteiramente para uma paleta de <strong>Tema Claro</strong> extremamente límpida, corporativa e educacional, substituindo quaisquer referências escuras anteriores. Isso traz um aspeto leve, acolhedor e profissional, maximizando a legibilidade de dados estruturados e notas estudantis.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {colors.map((c) => (
                <div key={c.hex} className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
                  <div className={`h-24 ${c.bgClass} flex items-end p-3 relative`}>
                    <button 
                      onClick={() => handleCopyColor(c.hex)}
                      className="absolute top-2 right-2 p-1.5 bg-white/20 backdrop-blur-md rounded-lg hover:bg-white/40 transition-colors text-white"
                      title="Copiar Hexadecimal"
                    >
                      {copiedColor === c.hex ? (
                        <Check className="w-3.5 h-3.5 text-emerald-200" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <span className="text-xs font-black drop-shadow-sm uppercase tracking-wide">{c.hex}</span>
                  </div>
                  <div className="p-3.5 space-y-1.5">
                    <p className="text-xs font-extrabold text-[#0D1B3D] truncate">{c.name}</p>
                    <p className="text-[9px] font-mono text-[#6B7280]">{c.rgb}</p>
                    <div className="h-[1px] bg-slate-100 my-1"></div>
                    <p className="text-[10px] text-[#6B7280] leading-snug h-12 overflow-y-auto no-scrollbar">{c.use}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 3: TIPOGRAFIA */}
          <section id="typography-section" className="bg-white p-6 md:p-8 rounded-3xl border border-[#E5E7EB] shadow-sm space-y-6">
            <div className="border-b border-[#E5E7EB] pb-4">
              <span className="text-[10px] font-black text-[#1E66F5] uppercase tracking-wider font-mono">Seção 03</span>
              <h2 className="text-xl md:text-2xl font-black text-[#0D1B3D]">Tipografia Corporativa</h2>
            </div>

            <p className="text-xs text-[#6B7280] leading-relaxed">
              A tipografia principal homologada é a <strong>"Poppins"</strong>. Trata-se de uma fonte geométrica sem serifa extremamente moderna, amigável e legível. Ela é aplicada aqui em tom azul-marinho escuro (#0D1B3D) sobre fundos brancos/off-white para oferecer o melhor balanço ergonômico.
            </p>

            <div className="bg-slate-50 p-6 rounded-2xl border border-[#E5E7EB] space-y-6 text-left">
              <div className="space-y-1">
                <span className="text-[9px] font-extrabold text-[#6B7280] uppercase tracking-wider font-mono">Visualização do Alfabeto (Poppins)</span>
                <p className="text-xl font-extrabold text-[#0D1B3D] tracking-tight font-poppins">
                  A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
                </p>
                <p className="text-xl font-medium text-[#0D1B3D] tracking-tight font-poppins">
                  a b c d e f g h i j k l m n o p q r s t u v w x y z
                </p>
                <p className="text-xl font-mono text-[#1E66F5] tracking-tight">
                  0 1 2 3 4 5 6 7 8 9 ( ) [ ] + - = % / @
                </p>
              </div>

              <div className="h-[1px] bg-slate-200"></div>

              <div className="space-y-4">
                <span className="text-[9px] font-extrabold text-[#6B7280] uppercase tracking-wider font-mono">Hierarquia Tipográfica de Layout</span>
                
                <div className="space-y-1">
                  <p className="text-xs text-[#6B7280] font-mono">Heading 1 (Poppins Bold 32px / 1.25)</p>
                  <p className="text-2xl md:text-3xl font-bold text-[#0D1B3D] tracking-tight">Painel Executivo de Gestão</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-[#6B7280] font-mono">Heading 2 (Poppins Semibold 20px)</p>
                  <p className="text-lg md:text-xl font-semibold text-[#0D1B3D] tracking-tight">Cadastro Geral de Estudantes</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-[#6B7280] font-mono">Body Text (Poppins Medium/Regular 13px)</p>
                  <p className="text-xs text-[#6B7280] leading-relaxed max-w-xl">
                    Com o sistema unificado do SysEdu, a coordenação escolar pode monitorar frequências diárias, lançar pautas de notas avaliativas e emitir recibos de mensalidades de forma totalmente intuitiva e segura.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: ÍCONES CORPORATIVOS */}
          <section id="icons-section" className="bg-white p-6 md:p-8 rounded-3xl border border-[#E5E7EB] shadow-sm space-y-6">
            <div className="border-b border-[#E5E7EB] pb-4">
              <span className="text-[10px] font-black text-[#1E66F5] uppercase tracking-wider font-mono">Seção 04</span>
              <h2 className="text-xl md:text-2xl font-black text-[#0D1B3D]">Ícones de Navegação</h2>
            </div>

            <p className="text-xs text-[#6B7280] leading-relaxed">
              Os ícones do sistema seguem uma linha <strong>outline fina (contorno de 1.5px a 2px)</strong>, sempre renderizados na cor azul primário (#1E66F5) ou secundário, abrigados dentro de um fundo circular branco. Isso mantém um ritmo visual uniforme por toda a interface SaaS.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {outlineIconsList.map((ic) => (
                <div key={ic.label} className="bg-slate-50 p-4 rounded-xl border border-[#E5E7EB] flex items-center gap-3.5 hover:border-[#1E66F5]/30 hover:bg-[#1E66F5]/5 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-200/80 flex items-center justify-center shrink-0">
                    {ic.icon}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-extrabold text-[#0D1B3D]">{ic.label}</p>
                    <p className="text-[9px] text-[#6B7280] uppercase tracking-wider font-mono">Outline 1.5px</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 5: VARIAÇÕES DA MARCA */}
          <section id="variations-section" className="bg-white p-6 md:p-8 rounded-3xl border border-[#E5E7EB] shadow-sm space-y-6">
            <div className="border-b border-[#E5E7EB] pb-4">
              <span className="text-[10px] font-black text-[#1E66F5] uppercase tracking-wider font-mono">Seção 05</span>
              <h2 className="text-xl md:text-2xl font-black text-[#0D1B3D]">Variações Homologadas da Marca</h2>
            </div>

            <p className="text-xs text-[#6B7280] leading-relaxed">
              Para garantir legibilidade perfeita em qualquer superfície gráfica, foram especificadas 3 variações oficiais da assinatura do logotipo SysEdu:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Versão Principal */}
              <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] flex flex-col items-center justify-between min-h-[220px] shadow-inner">
                <span className="text-[9px] font-bold text-[#1E66F5] uppercase tracking-wider bg-blue-50 px-2 py-1 rounded-full">Principal / Colorida</span>
                <div className="py-4">
                  <SysEduLogo variant="full" size={48} />
                </div>
                <p className="text-[10px] text-[#6B7280] text-center leading-snug">Aplicação prioritária sobre fundo claro (#FFFFFF a #F8FAFC).</p>
              </div>

              {/* Versão Monocromática */}
              <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] flex flex-col items-center justify-between min-h-[220px] shadow-inner">
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider bg-gray-50 px-2 py-1 rounded-full">Monocromática / Escala Cinza</span>
                <div className="py-4">
                  <SysEduLogo variant="monochrome" size={48} />
                </div>
                <p className="text-[10px] text-[#6B7280] text-center leading-snug">Para relatórios impressos em preto e branco, fax ou carimbos de baixo custo.</p>
              </div>

              {/* Versão Negativa */}
              <div className="bg-[#0D1B3D] p-6 rounded-2xl border border-[#0D1B3D] flex flex-col items-center justify-between min-h-[220px] text-white">
                <span className="text-[9px] font-bold text-blue-200 uppercase tracking-wider bg-white/10 px-2 py-1 rounded-full">Versão Negativa (Inversa)</span>
                <div className="py-4">
                  <SysEduLogo variant="negative" size={48} />
                </div>
                <p className="text-[10px] text-indigo-200 text-center leading-snug">Exclusiva para aplicação sobre fundos azuis escuros sólidos, fardamentos escuros ou rodapés.</p>
              </div>

            </div>
          </section>

          {/* SECTION 6: APLICAÇÃO DIGITAL (MOCKUPS INTERATIVOS TEMA CLARO) */}
          <section id="mockup-section" className="bg-white p-6 md:p-8 rounded-3xl border border-[#E5E7EB] shadow-sm space-y-8">
            <div className="border-b border-[#E5E7EB] pb-4">
              <span className="text-[10px] font-black text-[#1E66F5] uppercase tracking-wider font-mono">Seção 06</span>
              <h2 className="text-xl md:text-2xl font-black text-[#0D1B3D]">Aplicação Digital e Telas (Mockups Tema Claro)</h2>
            </div>

            <p className="text-xs text-[#6B7280] leading-relaxed">
              Confira abaixo a aplicação prática da nova identidade visual em três telas cruciais do sistema, todas reestruturadas para o <strong>Tema Claro consistente</strong> com fundos claros, sombras sutis e o logotipo do SysEdu inserido de forma imaculada.
            </p>

            {/* MOCKUP 1: DASHBOARD WEB */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Laptop className="w-5 h-5 text-[#1E66F5]" />
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0D1B3D]">Mockup 01: Tela de Dashboard Executivo (Web Desktop)</h4>
              </div>

              <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-[#E5E7EB] shadow-inner overflow-x-auto">
                <div className="min-w-[650px] bg-white rounded-xl border border-slate-200 shadow-md flex h-[350px] overflow-hidden text-left">
                  {/* Web Left Menu */}
                  <div className="w-48 bg-white border-r border-slate-150 p-3.5 flex flex-col justify-between">
                    <div className="space-y-4">
                      <SysEduLogo variant="full" size={26} />
                      
                      <div className="space-y-1 pt-2">
                        {[
                          { label: 'Visão Geral', active: true, icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
                          { label: 'Estudantes', active: false, icon: <GraduationCap className="w-3.5 h-3.5" /> },
                          { label: 'Docentes', active: false, icon: <Users className="w-3.5 h-3.5" /> },
                          { label: 'Turmas & Disciplinas', active: false, icon: <FolderGit className="w-3.5 h-3.5" /> },
                          { label: 'Financeiro', active: false, icon: <DollarSign className="w-3.5 h-3.5" /> }
                        ].map((mi) => (
                          <div 
                            key={mi.label}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold transition-colors ${
                              mi.active 
                                ? 'bg-blue-50 text-[#1E66F5]' 
                                : 'text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            {mi.icon}
                            <span>{mi.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="text-[9px] text-[#6B7280] border-t border-slate-100 pt-2 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>Portal Maputo Central</span>
                    </div>
                  </div>

                  {/* Web Dashboard Content */}
                  <div className="flex-1 bg-[#F8FAFC] p-4 flex flex-col justify-between overflow-y-auto">
                    {/* Header */}
                    <div className="flex justify-between items-center pb-2.5 border-b border-slate-150">
                      <div>
                        <h4 className="text-xs font-bold text-[#0D1B3D]">Painel da Direção</h4>
                        <p className="text-[9px] text-[#6B7280]">Indicadores consolidados em tempo real</p>
                      </div>
                      <span className="bg-emerald-500/10 text-[#10B981] text-[9px] font-extrabold px-2 py-0.5 rounded-full">Ativo</span>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-2 pt-2.5">
                      {[
                        { title: 'Estudantes', value: '1.248', rate: '+12%', color: 'border-l-4 border-blue-500' },
                        { title: 'Docentes', value: '86', rate: 'Ativos', color: 'border-l-4 border-[#10B981]' },
                        { title: 'Turmas', value: '48', rate: '9 Escolas', color: 'border-l-4 border-amber-500' },
                        { title: 'Frequência Hoje', value: '92%', rate: 'Estável', color: 'border-l-4 border-[#7DB7FF]' }
                      ].map((st) => (
                        <div key={st.title} className={`bg-white p-2.5 rounded-lg border border-slate-200 ${st.color} shadow-sm`}>
                          <p className="text-[9px] font-medium text-slate-500">{st.title}</p>
                          <p className="text-sm font-black text-[#0D1B3D] mt-0.5">{st.value}</p>
                          <p className="text-[8px] text-[#10B981] font-bold mt-0.5">{st.rate}</p>
                        </div>
                      ))}
                    </div>

                    {/* Two-Column Graphs */}
                    <div className="grid grid-cols-3 gap-3.5 pt-3.5 flex-1">
                      {/* Weekly frequency line graph mockup */}
                      <div className="col-span-2 bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
                        <p className="text-[9px] font-bold text-[#0D1B3D]">Gráfico de Frequência Semanal (%)</p>
                        <div className="h-20 flex items-end justify-between px-2 pt-2 border-b border-l border-slate-100">
                          {[
                            { day: 'Seg', val: 30, h: 'h-[82%]' },
                            { day: 'Ter', val: 40, h: 'h-[91%]' },
                            { day: 'Qua', val: 35, h: 'h-[95%]' },
                            { day: 'Qui', val: 60, h: 'h-[89%]' },
                            { day: 'Sex', val: 55, h: 'h-[92%]' }
                          ].map((b) => (
                            <div key={b.day} className="flex flex-col items-center flex-1 space-y-1">
                              <div className={`w-2.5 bg-[#1E66F5] rounded-t-sm ${b.h} transition-all`}></div>
                              <span className="text-[7px] text-slate-500">{b.day}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Assessments donut mockup */}
                      <div className="col-span-1 bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between items-center text-center">
                        <p className="text-[8px] font-bold text-[#0D1B3D] leading-tight">Status de Avaliações</p>
                        
                        {/* Interactive Rosca Donut Circle representation */}
                        <div className="relative w-12 h-12 flex items-center justify-center my-1">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path
                              className="text-slate-100"
                              strokeWidth="4"
                              stroke="currentColor"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path
                              className="text-[#10B981]"
                              strokeWidth="4"
                              strokeDasharray="60, 100"
                              strokeLinecap="round"
                              stroke="currentColor"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path
                              className="text-[#1E66F5]"
                              strokeWidth="4"
                              strokeDasharray="25, 100"
                              strokeDashoffset="-60"
                              strokeLinecap="round"
                              stroke="currentColor"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                          </svg>
                          <span className="absolute text-[8px] font-extrabold text-[#0D1B3D]">85%</span>
                        </div>

                        <div className="flex gap-1.5 justify-center text-[7px] text-slate-500">
                          <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 bg-[#10B981] rounded-full"></span> Verde</span>
                          <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 bg-[#1E66F5] rounded-full"></span> Azul</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* MOCKUP 2: LOGIN VIEW */}
            <div className="space-y-3 pt-4">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#1E66F5]" />
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0D1B3D]">Mockup 02: Tela de Acesso e Autenticação (Login)</h4>
              </div>

              <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-[#E5E7EB] shadow-inner flex justify-center">
                <div className="bg-white rounded-xl border border-slate-200 shadow-md p-6 max-w-sm w-full text-center space-y-4 text-left">
                  
                  {/* Centralized SysEdu Logo */}
                  <div className="flex justify-center py-2">
                    <SysEduLogo variant="vertical" size={54} showSlogan={false} />
                  </div>

                  <div className="space-y-1 text-center">
                    <h5 className="text-xs font-black text-[#0D1B3D]">Faça Login na Sua Conta</h5>
                    <p className="text-[10px] text-slate-400">Insira as credenciais unificadas abaixo</p>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">E-mail</label>
                      <input 
                        type="text" 
                        readOnly
                        value="direcao@maputocentral.edu"
                        className="w-full bg-[#F8FAFC] border border-slate-200 rounded-lg p-2 text-[10px] text-slate-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Senha</label>
                      <input 
                        type="password" 
                        readOnly
                        value="••••••••••••"
                        className="w-full bg-[#F8FAFC] border border-slate-200 rounded-lg p-2 text-[10px] text-slate-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-1.5">
                    <button className="w-full bg-[#1E66F5] text-white font-bold text-[10px] py-2 rounded-lg text-center cursor-default">
                      Entrar no Sistema
                    </button>
                    
                    <button className="w-full bg-white border border-slate-200 text-slate-700 font-bold text-[10px] py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-default">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.61a5.66 5.66 0 0 1-2.45 3.71v3.08h3.97c2.32-2.14 3.61-5.3 3.61-8.64z"/>
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.97-3.08c-1.1.74-2.51 1.18-3.96 1.18-3.05 0-5.63-2.06-6.55-4.83H1.38v3.18A12 12 0 0 0 12 24z"/>
                        <path fill="#FBBC05" d="M5.45 14.36A7.2 7.2 0 0 1 5 12c0-.82.14-1.63.4-2.36V6.46H1.38A11.97 11.97 0 0 0 0 12c0 1.98.48 3.85 1.38 5.54l4.07-3.18z"/>
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.92 11.92 0 0 0 12 0 12 12 0 0 0 1.38 6.46l4.07 3.18c.92-2.77 3.5-4.89 6.55-4.89z"/>
                      </svg>
                      Entrar com o Google
                    </button>
                  </div>

                </div>
              </div>
            </div>

            {/* MOCKUP 3: MOBILE INTERFACE */}
            <div className="space-y-3 pt-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#1E66F5]" />
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0D1B3D]">Mockup 03: Tela de Aplicativo do Aluno/Docente (App Mobile)</h4>
              </div>

              <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-[#E5E7EB] shadow-inner flex justify-center">
                <div className="w-[240px] h-[450px] bg-white rounded-[32px] border-4 border-[#0D1B3D] shadow-2xl overflow-hidden flex flex-col justify-between text-left font-poppins relative">
                  
                  {/* Speaker Notch */}
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-20 h-4 bg-[#0D1B3D] rounded-b-xl z-20"></div>
                  
                  {/* Mobile Header */}
                  <div className="bg-[#1E66F5] text-white pt-6 pb-4 px-3 space-y-2 rounded-b-2xl">
                    <div className="flex justify-between items-center text-[8px] pt-1 opacity-80">
                      <span>12:30</span>
                      <span>LTE 100%</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[9px] opacity-80 font-medium">Olá, Nelton</p>
                        <h5 className="text-[11px] font-black tracking-tight leading-none">Administrador SGE</h5>
                      </div>
                      <div className="w-7 h-7 rounded-full bg-white/20 border border-white/35 flex items-center justify-center text-[10px] font-bold">NB</div>
                    </div>
                  </div>

                  {/* Mobile Body scrollable content */}
                  <div className="flex-1 bg-slate-50 p-2.5 overflow-y-auto space-y-3 text-[10px]">
                    
                    {/* Summary bento-like micro cards */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-[8px] text-slate-400 font-extrabold block">Alunos</span>
                        <span className="text-xs font-black text-[#0D1B3D]">1.248</span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-[8px] text-slate-400 font-extrabold block">Presença</span>
                        <span className="text-xs font-black text-[#10B981]">92%</span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-[8px] text-slate-400 font-extrabold block">Avisos</span>
                        <span className="text-xs font-black text-amber-500">3 Novos</span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-[8px] text-slate-400 font-extrabold block">Mensagens</span>
                        <span className="text-xs font-black text-[#1E66F5]">7 Recebidas</span>
                      </div>
                    </div>

                    {/* Notice Section */}
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm space-y-1">
                      <p className="text-[8px] font-extrabold text-[#1E66F5] uppercase tracking-wider">Aviso da Direção Escolar</p>
                      <p className="text-[9px] font-extrabold text-[#0D1B3D]">Conselho Pedagógico Amanhã</p>
                      <p className="text-[8px] text-[#6B7280]">Reunião geral às 14h com todos os docentes no distrito sede.</p>
                    </div>
                  </div>

                  {/* Mobile Bottom Nav Bar */}
                  <div className="bg-white border-t border-slate-150 py-1.5 px-3 flex justify-between items-center text-[8px] text-[#6B7280]">
                    <div className="flex flex-col items-center text-[#1E66F5] font-extrabold">
                      <LayoutDashboard className="w-4.5 h-4.5 mb-0.5" />
                      <span>Início</span>
                    </div>
                    <div className="flex flex-col items-center font-medium">
                      <GraduationCap className="w-4.5 h-4.5 mb-0.5" />
                      <span>Alunos</span>
                    </div>
                    <div className="flex flex-col items-center font-medium">
                      <Users className="w-4.5 h-4.5 mb-0.5" />
                      <span>Turmas</span>
                    </div>
                    <div className="flex flex-col items-center font-medium">
                      <Settings className="w-4.5 h-4.5 mb-0.5" />
                      <span>Ajustes</span>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </section>

          {/* SECTION 7: APLICAÇÕES FÍSICAS */}
          <section id="physical-section" className="bg-white p-6 md:p-8 rounded-3xl border border-[#E5E7EB] shadow-sm space-y-6">
            <div className="border-b border-[#E5E7EB] pb-4">
              <span className="text-[10px] font-black text-[#1E66F5] uppercase tracking-wider font-mono">Seção 07</span>
              <h2 className="text-xl md:text-2xl font-black text-[#0D1B3D]">Aplicações Físicas e Merchandising</h2>
            </div>

            <p className="text-xs text-[#6B7280] leading-relaxed">
              Consistência de marca expandida para além das telas. Veja abaixo os mockups renderizados com CSS estilizado de materiais institucionais físicos com o logotipo oficial aplicado de forma uniforme:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Caderno Escolar */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-[#E5E7EB] flex flex-col items-center space-y-4">
                <span className="text-[9px] font-bold text-[#6B7280] uppercase tracking-wider block">Caderno / Agenda Corporativa</span>
                <div className="relative w-36 h-48 bg-white rounded-r-xl shadow-lg border-y border-r border-slate-200 overflow-hidden flex flex-col justify-between p-4 text-left">
                  {/* Spiral representation on the left */}
                  <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-slate-400 to-slate-200 flex flex-col justify-between py-2">
                    {[...Array(12)].map((_, i) => (
                      <div key={i} className="w-4 h-1 bg-slate-500 rounded-full -ml-1"></div>
                    ))}
                  </div>
                  <div></div>
                  <div className="flex flex-col items-center space-y-2">
                    <SysEduLogo variant="icon" size={40} />
                    <p className="text-[13px] font-black text-[#0D1B3D] tracking-tight text-center leading-none">Caderno Oficial</p>
                    <p className="text-[8px] text-slate-400 tracking-wide uppercase">SGE SÉRIE PREMIUM</p>
                  </div>
                  <div></div>
                </div>
                <p className="text-[10px] text-[#6B7280] leading-snug text-center">Capa branca de alta gramatura com logotipo centralizado e detalhes foscos.</p>
              </div>

              {/* Caneta Institucional */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-[#E5E7EB] flex flex-col items-center space-y-4 justify-between">
                <span className="text-[9px] font-bold text-[#6B7280] uppercase tracking-wider block">Caneta Esferográfica</span>
                <div className="w-full max-w-xs h-10 bg-white rounded-full shadow-md border border-slate-200 flex items-center justify-between px-3 relative overflow-hidden">
                  <div className="w-4 h-full bg-[#1E66F5] -ml-3 rounded-l-full shrink-0"></div>
                  <div className="flex items-center gap-1.5">
                    <SysEduLogo variant="icon" size={16} />
                    <span className="text-[10px] font-black text-[#0D1B3D]">SysEdu</span>
                  </div>
                  <div className="w-12 h-1 bg-[#10B981] rounded-full shrink-0"></div>
                </div>
                <p className="text-[10px] text-[#6B7280] leading-snug text-center">Caneta branca com detalhes em azul primário, clip metálico e gravação a laser.</p>
              </div>

              {/* Cartão de Visita */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-[#E5E7EB] flex flex-col items-center space-y-4">
                <span className="text-[9px] font-bold text-[#6B7280] uppercase tracking-wider block">Cartão de Visita Executivo</span>
                <div className="w-56 h-32 bg-white rounded-lg shadow-lg border border-slate-200 p-4 flex flex-col justify-between relative overflow-hidden text-left">
                  {/* Diagonal detailing line */}
                  <div className="absolute right-0 top-0 bottom-0 w-2 bg-[#10B981]"></div>
                  <div className="absolute right-2 top-0 bottom-0 w-1.5 bg-[#1E66F5]"></div>
                  
                  <SysEduLogo variant="full" size={26} />
                  
                  <div className="space-y-0.5 pt-2">
                    <p className="text-[10px] font-extrabold text-[#0D1B3D] leading-none">Nelton Benedito</p>
                    <p className="text-[7px] text-[#1E66F5] uppercase tracking-wider font-extrabold">Diretor Geral de Expansão</p>
                    <p className="text-[6px] text-slate-400 font-mono mt-1">suporte@sysedu.com | www.sysedu.com</p>
                  </div>
                </div>
                <p className="text-[10px] text-[#6B7280] leading-snug text-center">Fundo branco off-white premium com grafismos sutis em azul e verde-água.</p>
              </div>

              {/* Papel Timbrado Oficial */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-[#E5E7EB] flex flex-col items-center space-y-4">
                <span className="text-[9px] font-bold text-[#6B7280] uppercase tracking-wider block">Papel Timbrado de Ofício</span>
                <div className="w-36 h-48 bg-white rounded-sm shadow-md border border-slate-200 p-2.5 flex flex-col justify-between relative text-left">
                  <div className="border-b border-slate-100 pb-1.5">
                    <SysEduLogo variant="full" size={18} />
                  </div>
                  <div className="space-y-1 flex-1 py-2">
                    <div className="h-1.5 w-16 bg-slate-100 rounded-full"></div>
                    <div className="h-1.5 w-24 bg-slate-100 rounded-full"></div>
                    <div className="h-1.5 w-20 bg-slate-100 rounded-full"></div>
                  </div>
                  <div className="border-t border-slate-100 pt-1 flex justify-between text-[5px] text-slate-400 font-mono">
                    <span>Av. Karl Marx, Maputo</span>
                    <span>contato@sysedu.com</span>
                  </div>
                </div>
                <p className="text-[10px] text-[#6B7280] leading-snug text-center">Papel Sulfite A4 90g com cabeçalho colorido e rodapé institucional padronizado.</p>
              </div>

              {/* Pasta de Arquivos */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-[#E5E7EB] flex flex-col items-center space-y-4">
                <span className="text-[9px] font-bold text-[#6B7280] uppercase tracking-wider block">Pasta Escolar / Portfólio</span>
                <div className="w-48 h-36 bg-white rounded-r-2xl shadow-lg border-y border-r border-slate-200 overflow-hidden relative flex flex-col justify-between p-4 text-left">
                  {/* Left flap fold line */}
                  <div className="absolute left-0 top-0 bottom-0 w-3 bg-slate-100 border-r border-slate-200"></div>
                  <div className="absolute left-2.5 top-0 bottom-0 w-1 bg-[#1E66F5]"></div>
                  <div></div>
                  <div className="flex items-center gap-2">
                    <SysEduLogo variant="icon" size={32} />
                    <div>
                      <p className="text-xs font-black text-[#0D1B3D] leading-none">Pasta de Registros</p>
                      <p className="text-[7px] text-slate-400 uppercase tracking-widest mt-0.5">SysEdu Enterprise</p>
                    </div>
                  </div>
                  <div></div>
                </div>
                <p className="text-[10px] text-[#6B7280] leading-snug text-center">Acabamento refinado de pasta de papéis com o logotipo aplicado de forma consistente.</p>
              </div>

              {/* Crachá do Colaborador */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-[#E5E7EB] flex flex-col items-center space-y-4">
                <span className="text-[9px] font-bold text-[#6B7280] uppercase tracking-wider block">Crachá de Identificação</span>
                <div className="w-32 h-48 bg-white rounded-xl shadow-lg border border-slate-200 flex flex-col justify-between items-center p-3 text-center relative overflow-hidden">
                  
                  {/* Lanyard Attachment Hole */}
                  <div className="w-4 h-1.5 bg-slate-400 rounded-full my-0.5"></div>
                  
                  <div className="border-b border-slate-100 pb-1 w-full flex justify-center">
                    <SysEduLogo variant="icon" size={18} />
                  </div>

                  <div className="space-y-1 my-1">
                    {/* Placeholder image of user */}
                    <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded-full mx-auto flex items-center justify-center text-slate-400 overflow-hidden">
                      <User className="w-6 h-6" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-black text-[#0D1B3D] leading-none">Nelton Benedito</p>
                      <p className="text-[6px] text-[#1E66F5] font-extrabold uppercase">Administrador</p>
                    </div>
                  </div>

                  {/* Barcode representation */}
                  <div className="space-y-0.5 w-full">
                    <div className="h-4 bg-slate-250 flex items-center justify-between px-1.5 py-0.5 rounded border border-slate-200 overflow-hidden">
                      {[...Array(24)].map((_, i) => (
                        <div key={i} className={`h-full bg-slate-800 ${i % 3 === 0 ? 'w-[1.5px]' : i % 5 === 0 ? 'w-[2px]' : 'w-[0.5px]'}`}></div>
                      ))}
                    </div>
                    <span className="text-[5px] text-slate-400 font-mono">CODE: *SGE-NELTON-2026*</span>
                  </div>

                </div>
                <p className="text-[10px] text-[#6B7280] leading-snug text-center">Crachá de identificação PVC com foto, cargo em azul e código de barras inferior.</p>
              </div>

            </div>
          </section>

          {/* SECTION 8: ATRIBUTOS DA MARCA */}
          <section id="attributes-section" className="bg-white p-6 md:p-8 rounded-3xl border border-[#E5E7EB] shadow-sm space-y-6">
            <div className="border-b border-[#E5E7EB] pb-4">
              <span className="text-[10px] font-black text-[#1E66F5] uppercase tracking-wider font-mono">Seção 08</span>
              <h2 className="text-xl md:text-2xl font-black text-[#0D1B3D]">Atributos da Identidade SysEdu</h2>
            </div>

            <p className="text-xs text-[#6B7280] leading-relaxed">
              Os cinco valores nucleares que guiam cada decisão de design, engenharia de software e suporte do ecossistema SysEdu:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              {brandAttributes.map((attr) => (
                <div key={attr.title} className="bg-slate-50 p-4 rounded-xl border border-[#E5E7EB] space-y-2.5 hover:shadow-md transition-all text-left">
                  <div className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-100">
                    {attr.icon}
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-[#0D1B3D]">{attr.title}</h5>
                    <p className="text-[10px] text-[#6B7280] leading-relaxed mt-1">{attr.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}
