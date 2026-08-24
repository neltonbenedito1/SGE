import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Briefcase, 
  GraduationCap, 
  Plus, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Upload, 
  Building2, 
  FileText,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Sparkles,
  Info
} from 'lucide-react';
import { Docente, Escola, FormacaoAcademica, User as UserType } from '../types';

interface DocenteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (docenteData: Partial<Docente>, extraUserData: { email: string; nome: string }) => Promise<void>;
  editingDocente: Docente | null;
  schools: Escola[];
  tenantUsers?: UserType[];
  isSaving?: boolean;
}

const MOZAMBIQUE_PROVINCES = [
  'Maputo Cidade',
  'Maputo Província',
  'Gaza',
  'Inhambane',
  'Sofala',
  'Manica',
  'Tete',
  'Zambézia',
  'Nampula',
  'Cabo Delgado',
  'Niassa',
  'Estrangeiro / Outro'
];

const NATIONALITIES = [
  'Moçambicana',
  'Angolana',
  'Portuguesa',
  'Brasileira',
  'Sul-Africana',
  'Zimbabuana',
  'Caboverdiana',
  'Santomeense',
  'Outra'
];

const MARITAL_STATUSES = [
  'Solteiro(a)',
  'Casado(a)',
  'Divorciado(a)',
  'Viúvo(a)',
  'União de Facto'
];

const PROFESSIONAL_CATEGORIES = [
  'Professor Catedrático',
  'Professor Associado',
  'Professor Auxiliar',
  'Assistente Universitário',
  'Docente do Ensino Secundário',
  'Docente do Ensino Básico',
  'Instrutor Técnico',
  'Formador Profissional',
  'Outro'
];

const ROLES_FUNCTIONS = [
  'Professor / Docente',
  'Chefe de Departamento',
  'Coordenador de Curso',
  'Diretor Adjunto Pedagógico',
  'Coordenador de Disciplina',
  'Diretor de Turma',
  'Tutor Académico',
  'Outro'
];

const DEPARTMENTS = [
  'Departamento de Ciências Exatas & Matemática',
  'Departamento de Ciências Naturais & Biologia',
  'Departamento de Letras & Línguas',
  'Departamento de Ciências Humanas & Sociais',
  'Faculdade de Engenharia & Tecnologias',
  'Faculdade de Economia, Gestão & Contabilidade',
  'Faculdade de Ciências de Saúde',
  'Coordenação Geral Pedagógica',
  'Outro'
];

const VINCULO_TYPES = [
  'Efetivo',
  'Contratado',
  'Colaborador',
  'Substituto',
  'Tempo Parcial'
];

const WORK_REGIMES = [
  'Tempo Integral (Full-time)',
  'Tempo Parcial (Part-time)',
  'Horista'
];

const ACADEMIC_DEGREES = [
  'Licenciatura',
  'Mestrado',
  'Doutoramento',
  'Bacharelato',
  'Pós-Graduação',
  'Especialização',
  'Técnico Médio'
];

const AVAILABLE_CURSOS = [
  'Ensino Geral Primário',
  'Ensino Geral Secundário',
  'Ciências & Tecnologias',
  'Economia & Gestão',
  'Informática & TICs',
  'Engenharia Informática',
  'Contabilidade & Auditoria',
  'Direito & Relações Internacionais',
  'Língua Portuguesa & Literatura',
  'Matemática & Física'
];

export default function DocenteFormModal({
  isOpen,
  onClose,
  onSave,
  editingDocente,
  schools,
  tenantUsers = [],
  isSaving = false
}: DocenteFormModalProps) {
  const [activeTab, setActiveTab] = useState<'pessoal' | 'profissional' | 'academica'>('pessoal');

  // 1.1 Informações Pessoais
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [genero, setGenero] = useState<'Masculino' | 'Feminino'>('Masculino');
  const [nacionalidade, setNacionalidade] = useState('Moçambicana');
  const [estadoCivil, setEstadoCivil] = useState('Solteiro(a)');
  const [documentoIdentificacao, setDocumentoIdentificacao] = useState('');
  const [nuit, setNuit] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cidadeProvincia, setCidadeProvincia] = useState('Maputo Cidade');
  const [fotoUrl, setFotoUrl] = useState('');

  // 1.2 Informações Profissionais
  const [codigoDocente, setCodigoDocente] = useState('');
  const [categoriaProfissional, setCategoriaProfissional] = useState(PROFESSIONAL_CATEGORIES[0]);
  const [cargo, setCargo] = useState(ROLES_FUNCTIONS[0]);
  const [departamento, setDepartamento] = useState(DEPARTMENTS[0]);
  const [cursosLecionados, setCursosLecionados] = useState<string[]>([]);
  const [especialidade, setEspecialidade] = useState('');
  const [numeroRegistro, setNumeroRegistro] = useState('');
  const [dataAdmissao, setDataAdmissao] = useState('');
  const [tipoVinculo, setTipoVinculo] = useState(VINCULO_TYPES[0]);
  const [regimeTrabalho, setRegimeTrabalho] = useState(WORK_REGIMES[0]);
  const [escolaId, setEscolaId] = useState('');

  // 1.3 Formação Académica
  const [formacoes, setFormacoes] = useState<FormacaoAcademica[]>([
    {
      grau: 'Licenciatura',
      curso: '',
      instituicao: '',
      ano_conclusao: new Date().getFullYear().toString(),
      pais: 'Moçambique'
    }
  ]);

  // Load editing docente
  useEffect(() => {
    if (!isOpen) return;
    
    if (editingDocente) {
      const linkedUser = tenantUsers.find(u => u.id === editingDocente.user_id);
      setNome(editingDocente.nome || linkedUser?.nome || '');
      setDataNascimento(editingDocente.data_nascimento || '');
      setGenero((editingDocente.genero as 'Masculino' | 'Feminino') || 'Masculino');
      setNacionalidade(editingDocente.nacionalidade || 'Moçambicana');
      setEstadoCivil(editingDocente.estado_civil || 'Solteiro(a)');
      setDocumentoIdentificacao(editingDocente.documento_identificacao || '');
      setNuit(editingDocente.nuit || '');
      setTelefone(editingDocente.telefone || '');
      setEmail(editingDocente.email || linkedUser?.email || '');
      setEndereco(editingDocente.endereco || '');
      setCidadeProvincia(editingDocente.cidade_provincia || 'Maputo Cidade');
      setFotoUrl(editingDocente.foto_url || '');

      setCodigoDocente(editingDocente.codigo_docente || editingDocente.id || '');
      setCategoriaProfissional(editingDocente.categoria_profissional || PROFESSIONAL_CATEGORIES[0]);
      setCargo(editingDocente.cargo || ROLES_FUNCTIONS[0]);
      setDepartamento(editingDocente.departamento || DEPARTMENTS[0]);
      setCursosLecionados(editingDocente.cursos_lecionados || []);
      setEspecialidade(editingDocente.especialidade || '');
      setNumeroRegistro(editingDocente.numero_registro || '');
      setDataAdmissao(editingDocente.data_admissao || editingDocente.data_contratacao || '');
      setTipoVinculo(editingDocente.tipo_vinculo || VINCULO_TYPES[0]);
      setRegimeTrabalho(editingDocente.regime_trabalho || WORK_REGIMES[0]);
      setEscolaId(editingDocente.escola_id || (schools[0]?.id || ''));

      if (editingDocente.formacoes_academicas && editingDocente.formacoes_academicas.length > 0) {
        setFormacoes(editingDocente.formacoes_academicas);
      } else {
        setFormacoes([{
          grau: 'Licenciatura',
          curso: editingDocente.especialidade || '',
          instituicao: '',
          ano_conclusao: new Date().getFullYear().toString(),
          pais: 'Moçambique'
        }]);
      }
    } else {
      // Reset
      setNome('');
      setDataNascimento('');
      setGenero('Masculino');
      setNacionalidade('Moçambicana');
      setEstadoCivil('Solteiro(a)');
      setDocumentoIdentificacao('');
      setNuit('');
      setTelefone('');
      setEmail('');
      setEndereco('');
      setCidadeProvincia('Maputo Cidade');
      setFotoUrl('');

      const autoGenCode = `DOC-${Math.floor(1000 + Math.random() * 9000)}`;
      setCodigoDocente(autoGenCode);
      setCategoriaProfissional(PROFESSIONAL_CATEGORIES[0]);
      setCargo(ROLES_FUNCTIONS[0]);
      setDepartamento(DEPARTMENTS[0]);
      setCursosLecionados([]);
      setEspecialidade('');
      setNumeroRegistro('');
      setDataAdmissao(new Date().toISOString().split('T')[0]);
      setTipoVinculo(VINCULO_TYPES[0]);
      setRegimeTrabalho(WORK_REGIMES[0]);
      setEscolaId(schools[0]?.id || '');

      setFormacoes([
        {
          grau: 'Licenciatura',
          curso: '',
          instituicao: '',
          ano_conclusao: new Date().getFullYear().toString(),
          pais: 'Moçambique'
        }
      ]);
    }
  }, [editingDocente, isOpen]);

  // Compute Missing Items for Activity generation
  const computeMissingData = (): string[] => {
    const missing: string[] = [];
    if (!nome.trim()) missing.push('Nome Completo');
    if (!dataNascimento) missing.push('Data de Nascimento');
    if (!documentoIdentificacao.trim()) missing.push('Documento de Identificação (BI/DIRE)');
    if (!nuit.trim()) missing.push('NUIT');
    if (!telefone.trim()) missing.push('Contacto Telefónico');
    if (!email.trim()) missing.push('E-mail');
    if (!endereco.trim()) missing.push('Endereço de Residência');
    if (!cidadeProvincia.trim()) missing.push('Cidade/Província');

    const validFormacoes = formacoes.filter(f => f.curso.trim() && f.instituicao.trim());
    if (validFormacoes.length === 0) {
      missing.push('Formação Académica Completa');
    }
    return missing;
  };

  const missingItems = computeMissingData();
  const completenessPercentage = Math.round(((9 - missingItems.length) / 9) * 100);

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const dadosEmFalta = computeMissingData();

    const docenteData: Partial<Docente> = {
      nome: nome.trim(),
      genero,
      nacionalidade,
      estado_civil: estadoCivil,
      categoria_profissional: categoriaProfissional,
      cargo,
      departamento,
      cursos_lecionados: cursosLecionados,
      especialidade: especialidade.trim() || (formacoes[0]?.curso || 'Docência Geral'),
      data_admissao: dataAdmissao || new Date().toISOString().split('T')[0],
      data_contratacao: dataAdmissao || new Date().toISOString().split('T')[0],
      tipo_vinculo: tipoVinculo,
      regime_trabalho: regimeTrabalho,
      escola_id: escolaId || (schools[0]?.id || ''),
      ativo: true,

      formacoes_academicas: formacoes.filter(f => f.curso.trim() || f.instituicao.trim()),
      dados_em_falta: dadosEmFalta,
      updated_at: new Date().toISOString()
    };

    if (dataNascimento) docenteData.data_nascimento = dataNascimento;
    if (documentoIdentificacao.trim()) docenteData.documento_identificacao = documentoIdentificacao.trim();
    if (nuit.trim()) docenteData.nuit = nuit.trim();
    if (telefone.trim()) docenteData.telefone = telefone.trim();
    if (email.trim()) docenteData.email = email.trim().toLowerCase();
    if (endereco.trim()) docenteData.endereco = endereco.trim();
    if (cidadeProvincia) docenteData.cidade_provincia = cidadeProvincia;
    if (fotoUrl.trim()) docenteData.foto_url = fotoUrl.trim();
    if (codigoDocente.trim()) docenteData.codigo_docente = codigoDocente.trim();
    if (numeroRegistro.trim()) docenteData.numero_registro = numeroRegistro.trim();

    await onSave(docenteData, {
      email: email.trim().toLowerCase(),
      nome: nome.trim()
    });
  };

  // Formation Helpers
  const handleAddFormacao = () => {
    setFormacoes([
      ...formacoes,
      {
        grau: 'Licenciatura',
        curso: '',
        instituicao: '',
        ano_conclusao: new Date().getFullYear().toString(),
        pais: 'Moçambique'
      }
    ]);
  };

  const handleRemoveFormacao = (index: number) => {
    if (formacoes.length <= 1) return;
    setFormacoes(formacoes.filter((_, i) => i !== index));
  };

  const handleUpdateFormacao = (index: number, field: keyof FormacaoAcademica, value: any) => {
    const updated = [...formacoes];
    updated[index] = { ...updated[index], [field]: value };
    setFormacoes(updated);
  };

  const toggleCurso = (c: string) => {
    if (cursosLecionados.includes(c)) {
      setCursosLecionados(cursosLecionados.filter(item => item !== c));
    } else {
      setCursosLecionados([...cursosLecionados, c]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-150 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white font-sans">
                  {editingDocente ? 'Editar Ficha e Perfil do Docente' : 'Cadastro Oficial de Docente'}
                </h2>
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                  completenessPercentage === 100 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {completenessPercentage}% Completo
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Gestão estruturada de informações pessoais, vínculos profissionais e formação académica.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Navigation */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 px-6 pt-3 gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('pessoal')}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 transition-all border-b-2 cursor-pointer ${
              activeTab === 'pessoal'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <User className="w-4 h-4" />
            1. Informações Pessoais
            <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded">
              Obrigatórias
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profissional')}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 transition-all border-b-2 cursor-pointer ${
              activeTab === 'profissional'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            2. Informações Profissionais
            <span className="text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
              Opcionais
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('academica')}
            className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 transition-all border-b-2 cursor-pointer ${
              activeTab === 'academica'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            3. Formação Académica
            <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded">
              Obrigatória
            </span>
          </button>
        </div>

        {/* Missing Data Warning Banner (Non-blocking notification) */}
        {missingItems.length > 0 && (
          <div className="mx-6 mt-4 p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-2xl flex items-start gap-3 text-xs text-amber-900 dark:text-amber-300">
            <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">
                Cadastro flexível ativo: O sistema permite criar o Docente mesmo com dados em falta.
              </p>
              <p className="text-[11px] text-amber-800 dark:text-amber-400 mt-0.5 leading-relaxed">
                Campos pendentes para perfil completo: <span className="font-semibold">{missingItems.join(', ')}</span>. Uma pendência será sincronizada automaticamente no módulo <strong>Actividades</strong> para acompanhamento.
              </p>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: INFORMAÇÕES PESSOAIS (OBRIGATÓRIAS) */}
          {activeTab === 'pessoal' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              
              {/* Foto do Docente */}
              <div className="flex items-center gap-5 p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-2xl">
                <div className="w-20 h-20 rounded-2xl bg-white dark:bg-slate-700 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                  {fotoUrl ? (
                    <img src={fotoUrl} alt="Foto do Docente" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Foto do Docente / Avatar
                  </label>
                  <input
                    type="url"
                    placeholder="https://exemplo.com/foto-docente.jpg (ou cole URL da foto)"
                    value={fotoUrl}
                    onChange={(e) => setFotoUrl(e.target.value)}
                    className="w-full bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100"
                  />
                  <p className="text-[10px] text-slate-400">
                    Insira uma URL direta para a fotografia de perfil do professor.
                  </p>
                </div>
              </div>

              {/* Nome Completo & Data de Nascimento */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nome Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Prof. Dr. Armando Manuel Sitoe"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Data de Nascimento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Sexo, Nacionalidade & Estado Civil (Dropdowns Padronizados) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Sexo <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={genero}
                    onChange={(e) => setGenero(e.target.value as 'Masculino' | 'Feminino')}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-medium text-slate-800 dark:text-slate-100"
                  >
                    <option value="Masculino">Masculino</option>
                    <option value="Feminino">Feminino</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nacionalidade <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={nacionalidade}
                    onChange={(e) => setNacionalidade(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-medium text-slate-800 dark:text-slate-100"
                  >
                    {NATIONALITIES.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Estado Civil <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={estadoCivil}
                    onChange={(e) => setEstadoCivil(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-medium text-slate-800 dark:text-slate-100"
                  >
                    {MARITAL_STATUSES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Documento de Identificação & NUIT */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nº do Documento de Identificação (BI / DIRE / Passaporte) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 110100234589B ou 02003498"
                    value={documentoIdentificacao}
                    onChange={(e) => setDocumentoIdentificacao(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-mono text-slate-800 dark:text-slate-100 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    NUIT (Número Único de Identificação Tributária) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 400123987 (9 dígitos)"
                    value={nuit}
                    onChange={(e) => setNuit(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Contactos: Telefone & E-mail */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Contacto Telefónico <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="tel"
                      placeholder="Ex: +258 84 123 4567"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      className="w-full pl-9 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-800 dark:text-slate-100 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    E-mail Institucional / Pessoal <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="Ex: docente.armando@escola.ac.mz"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* Endereço & Província */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Endereço de Residência <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Ex: Av. Eduardo Mondlane, Bairro Central, Casa 45"
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      className="w-full pl-9 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Cidade / Província <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={cidadeProvincia}
                    onChange={(e) => setCidadeProvincia(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-medium text-slate-800 dark:text-slate-100"
                  >
                    {MOZAMBIQUE_PROVINCES.map((prov) => (
                      <option key={prov} value={prov}>{prov}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INFORMAÇÕES PROFISSIONAIS (OPCIONAIS NO CADASTRO) */}
          {activeTab === 'profissional' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              
              {/* Código/ID & Escola de Alocação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Código / ID do Docente
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: DOC-8042"
                    value={codigoDocente}
                    onChange={(e) => setCodigoDocente(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-mono text-slate-800 dark:text-slate-100"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Identificador institucional único do professor.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Escola de Alocação Principal
                  </label>
                  <select
                    value={escolaId}
                    onChange={(e) => setEscolaId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-medium text-slate-800 dark:text-slate-100"
                  >
                    {schools.map((sc) => (
                      <option key={sc.id} value={sc.id}>{sc.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Categoria Profissional, Cargo & Departamento (Dropdowns Padronizados) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Categoria Profissional
                  </label>
                  <select
                    value={categoriaProfissional}
                    onChange={(e) => setCategoriaProfissional(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-medium text-slate-800 dark:text-slate-100"
                  >
                    {PROFESSIONAL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Cargo / Função Institucional
                  </label>
                  <select
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-medium text-slate-800 dark:text-slate-100"
                  >
                    {ROLES_FUNCTIONS.map((rf) => (
                      <option key={rf} value={rf}>{rf}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Departamento / Faculdade
                  </label>
                  <select
                    value={departamento}
                    onChange={(e) => setDepartamento(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-medium text-slate-800 dark:text-slate-100"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Área de Especialização & Nº de Registro Profissional */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Área de Especialização / Domínio Principal
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Metodologias do Ensino de Matemática e Física"
                    value={especialidade}
                    onChange={(e) => setEspecialidade(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nº de Registro Profissional / Carteira Docente
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: REG-MZ-2026/09"
                    value={numeroRegistro}
                    onChange={(e) => setNumeroRegistro(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-mono text-slate-800 dark:text-slate-100 uppercase"
                  />
                </div>
              </div>

              {/* Data de Admissão, Tipo de Vínculo & Regime de Trabalho (Dropdowns Padronizados) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Data de Admissão
                  </label>
                  <input
                    type="date"
                    value={dataAdmissao}
                    onChange={(e) => setDataAdmissao(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Tipo de Vínculo
                  </label>
                  <select
                    value={tipoVinculo}
                    onChange={(e) => setTipoVinculo(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-medium text-slate-800 dark:text-slate-100"
                  >
                    {VINCULO_TYPES.map((vt) => (
                      <option key={vt} value={vt}>{vt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Regime de Trabalho
                  </label>
                  <select
                    value={regimeTrabalho}
                    onChange={(e) => setRegimeTrabalho(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-medium text-slate-800 dark:text-slate-100"
                  >
                    {WORK_REGIMES.map((wr) => (
                      <option key={wr} value={wr}>{wr}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cursos em que leciona */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Curso(s) em que Leciona
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_CURSOS.map((c) => {
                    const isSelected = cursosLecionados.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleCurso(c)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '} {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FORMAÇÃO ACADÉMICA (OBRIGATÓRIA) */}
          {activeTab === 'academica' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Formações Académicas & Titulações
                  </h4>
                  <p className="text-xs text-slate-400">
                    Obrigatório registar pelo menos uma formação académica para o perfil do docente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddFormacao}
                  className="bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Adicionar Outra Titulação
                </button>
              </div>

              <div className="space-y-4">
                {formacoes.map((formacao, idx) => (
                  <div 
                    key={idx} 
                    className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-2xl space-y-4 relative group"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/40 pb-2.5">
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4" /> Formação #{idx + 1}
                      </span>
                      {formacoes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFormacao(idx)}
                          className="text-rose-500 hover:text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remover
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Grau Académico <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formacao.grau}
                          onChange={(e) => handleUpdateFormacao(idx, 'grau', e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-medium text-slate-800 dark:text-slate-100"
                        >
                          {ACADEMIC_DEGREES.map((deg) => (
                            <option key={deg} value={deg}>{deg}</option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Curso / Área de Formação <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Licenciatura em Ensino de Física"
                          value={formacao.curso}
                          onChange={(e) => handleUpdateFormacao(idx, 'curso', e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Instituição de Ensino Superior / Técnico <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Universidade Eduardo Mondlane (UEM) ou UP-Maputo"
                          value={formacao.instituicao}
                          onChange={(e) => handleUpdateFormacao(idx, 'instituicao', e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Ano de Conclusão <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="1960"
                          max="2035"
                          placeholder="2020"
                          value={formacao.ano_conclusao}
                          onChange={(e) => handleUpdateFormacao(idx, 'ano_conclusao', e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-mono text-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500">
              {activeTab === 'pessoal' && (
                <span>Preencha as informações pessoais básicas do docente.</span>
              )}
              {activeTab === 'profissional' && (
                <span>Vínculos e categorias podem ser complementados a qualquer momento.</span>
              )}
              {activeTab === 'academica' && (
                <span>Cadastre as titulações que compõem o dossier académico do professor.</span>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-indigo-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Salvando Dados...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Salvar Ficha do Docente
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
