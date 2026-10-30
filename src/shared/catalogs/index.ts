/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Catálogo Central de Dados - Sistema de Gestão Educacional (SGE)
 * Fonte Única de Verdade (Single Source of Truth)
 */

export interface CatalogItem<T = string> {
  value: T;
  labelKey: string;
  labelDefault: string;
  order: number;
  active: boolean;
  color?: string;
  badgeClass?: string;
  meta?: Record<string, any>;
}

// 1. Estados de Aula / Plano de Aulas
export const LESSON_STATUS_CATALOG: CatalogItem[] = [
  { value: 'planned', labelKey: 'catalog.lesson_status.planned', labelDefault: 'Planeada', order: 1, active: true, color: 'blue', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'taught', labelKey: 'catalog.lesson_status.taught', labelDefault: 'Lecionada', order: 2, active: true, color: 'emerald', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'pending', labelKey: 'catalog.lesson_status.pending', labelDefault: 'Pendente', order: 3, active: true, color: 'amber', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'cancelled', labelKey: 'catalog.lesson_status.cancelled', labelDefault: 'Cancelada', order: 4, active: true, color: 'rose', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'extraordinary', labelKey: 'catalog.lesson_status.extraordinary', labelDefault: 'Extraordinária', order: 5, active: true, color: 'purple', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
];

// 2. Estados Genéricos de Entidades
export const GENERIC_STATUS_CATALOG: CatalogItem[] = [
  { value: 'active', labelKey: 'catalog.status.active', labelDefault: 'Ativo', order: 1, active: true, color: 'emerald', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'inactive', labelKey: 'catalog.status.inactive', labelDefault: 'Inativo', order: 2, active: true, color: 'slate', badgeClass: 'bg-slate-50 text-slate-700 border-slate-200' },
  { value: 'suspended', labelKey: 'catalog.status.suspended', labelDefault: 'Suspenso', order: 3, active: true, color: 'amber', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'archived', labelKey: 'catalog.status.archived', labelDefault: 'Arquivado', order: 4, active: true, color: 'zinc', badgeClass: 'bg-zinc-50 text-zinc-700 border-zinc-200' },
];

// 3. Perfis e Papéis de Utilizador (RBAC)
export const USER_ROLES_CATALOG: CatalogItem[] = [
  { value: 'super_admin', labelKey: 'catalog.role.super_admin', labelDefault: 'Super Administrador', order: 1, active: true, color: 'red' },
  { value: 'admin', labelKey: 'catalog.role.admin', labelDefault: 'Administrador da Instituição', order: 2, active: true, color: 'indigo' },
  { value: 'director', labelKey: 'catalog.role.director', labelDefault: 'Director Geral', order: 3, active: true, color: 'blue' },
  { value: 'pedagogical_director', labelKey: 'catalog.role.pedagogical_director', labelDefault: 'Director Pedagógico', order: 4, active: true, color: 'teal' },
  { value: 'general_secretary', labelKey: 'catalog.role.general_secretary', labelDefault: 'Secretaria Geral', order: 5, active: true, color: 'cyan' },
  { value: 'docente', labelKey: 'catalog.role.teacher', labelDefault: 'Professor / Docente', order: 6, active: true, color: 'emerald' },
  { value: 'estudante', labelKey: 'catalog.role.student', labelDefault: 'Estudante', order: 7, active: true, color: 'sky' },
  { value: 'pai', labelKey: 'catalog.role.guardian', labelDefault: 'Encarregado de Educação', order: 8, active: true, color: 'amber' },
  { value: 'librarian', labelKey: 'catalog.role.librarian', labelDefault: 'Bibliotecário', order: 9, active: true, color: 'orange' },
  { value: 'finance', labelKey: 'catalog.role.finance', labelDefault: 'Gestor Financeiro', order: 10, active: true, color: 'emerald' },
  { value: 'suporte', labelKey: 'catalog.role.support', labelDefault: 'Suporte Técnico', order: 11, active: true, color: 'violet' },
];

// 4. Níveis de Ensino
export const EDUCATION_LEVELS_CATALOG: CatalogItem[] = [
  { value: 'primario', labelKey: 'catalog.education_level.primario', labelDefault: 'Ensino Primário (1ª a 6ª)', order: 1, active: true, color: 'sky' },
  { value: 'secundario', labelKey: 'catalog.education_level.secundario', labelDefault: 'Ensino Secundário (8ª a 12ª)', order: 2, active: true, color: 'indigo' },
  { value: 'superior', labelKey: 'catalog.education_level.superior', labelDefault: 'Ensino Superior (Faculdade / Universidade)', order: 3, active: true, color: 'purple' },
  { value: 'profissional', labelKey: 'catalog.education_level.profissional', labelDefault: 'Formação Profissional (Institutos e Centros)', order: 4, active: true, color: 'emerald' },
];

// 5. Tipos de Instituição / Unidade Escolar
export const INSTITUTION_TYPES_CATALOG: CatalogItem[] = [
  { value: 'Escola', labelKey: 'catalog.institution_type.escola', labelDefault: 'Escola', order: 1, active: true, color: 'blue' },
  { value: 'Faculdade', labelKey: 'catalog.institution_type.faculdade', labelDefault: 'Faculdade', order: 2, active: true, color: 'purple' },
  { value: 'Instituto', labelKey: 'catalog.institution_type.instituto', labelDefault: 'Instituto', order: 3, active: true, color: 'emerald' },
];

// 6. Turnos / Regimes de Aulas
export const SHIFTS_CATALOG: CatalogItem[] = [
  { value: 'manha', labelKey: 'catalog.shift.manha', labelDefault: 'Manhã', order: 1, active: true },
  { value: 'tarde', labelKey: 'catalog.shift.tarde', labelDefault: 'Tarde', order: 2, active: true },
  { value: 'noite', labelKey: 'catalog.shift.noite', labelDefault: 'Noite', order: 3, active: true },
];

// 7. Género
export const GENDERS_CATALOG: CatalogItem[] = [
  { value: 'Masculino', labelKey: 'catalog.gender.masculino', labelDefault: 'Masculino', order: 1, active: true },
  { value: 'Feminino', labelKey: 'catalog.gender.feminino', labelDefault: 'Feminino', order: 2, active: true },
];

// 8. Estado Civil
export const MARITAL_STATUS_CATALOG: CatalogItem[] = [
  { value: 'solteiro', labelKey: 'catalog.marital.solteiro', labelDefault: 'Solteiro(a)', order: 1, active: true },
  { value: 'casado', labelKey: 'catalog.marital.casado', labelDefault: 'Casado(a)', order: 2, active: true },
  { value: 'uniao_facto', labelKey: 'catalog.marital.uniao_facto', labelDefault: 'União de Facto', order: 3, active: true },
  { value: 'divorciado', labelKey: 'catalog.marital.divorciado', labelDefault: 'Divorciado(a)', order: 4, active: true },
  { value: 'viuvo', labelKey: 'catalog.marital.viuvo', labelDefault: 'Viúvo(a)', order: 5, active: true },
];

// 9. Tipos de Documento de Identificação
export const DOCUMENT_TYPES_CATALOG: CatalogItem[] = [
  { value: 'bi', labelKey: 'catalog.doc.bi', labelDefault: 'Bilhete de Identidade (BI)', order: 1, active: true },
  { value: 'passaporte', labelKey: 'catalog.doc.passaporte', labelDefault: 'Passaporte', order: 2, active: true },
  { value: 'dire', labelKey: 'catalog.doc.dire', labelDefault: 'DIRE (Documento de Identificação de Residente Estrangeiro)', order: 3, active: true },
  { value: 'cartao_eleitor', labelKey: 'catalog.doc.cartao_eleitor', labelDefault: 'Cartão de Eleitor', order: 4, active: true },
  { value: 'certidao_nascimento', labelKey: 'catalog.doc.certidao', labelDefault: 'Certidão de Nascimento', order: 5, active: true },
  { value: 'outro', labelKey: 'catalog.doc.outro', labelDefault: 'Outro Documento Oficial', order: 6, active: true },
];

// 10. Grupos Sanguíneos
export const BLOOD_GROUPS_CATALOG: CatalogItem[] = [
  { value: 'desconhecido', labelKey: 'catalog.blood.desconhecido', labelDefault: 'Não sei', order: 1, active: true },
  { value: 'A+', labelKey: 'catalog.blood.a_pos', labelDefault: 'A+', order: 2, active: true },
  { value: 'A-', labelKey: 'catalog.blood.a_neg', labelDefault: 'A-', order: 3, active: true },
  { value: 'B+', labelKey: 'catalog.blood.b_pos', labelDefault: 'B+', order: 4, active: true },
  { value: 'B-', labelKey: 'catalog.blood.b_neg', labelDefault: 'B-', order: 5, active: true },
  { value: 'AB+', labelKey: 'catalog.blood.ab_pos', labelDefault: 'AB+', order: 6, active: true },
  { value: 'AB-', labelKey: 'catalog.blood.ab_neg', labelDefault: 'AB-', order: 7, active: true },
  { value: 'O+', labelKey: 'catalog.blood.o_pos', labelDefault: 'O+', order: 8, active: true },
  { value: 'O-', labelKey: 'catalog.blood.o_neg', labelDefault: 'O-', order: 9, active: true },
];

// 11. Graus de Parentesco (Encarregados)
export const GUARDIAN_RELATIONSHIPS_CATALOG: CatalogItem[] = [
  { value: 'pai', labelKey: 'catalog.relationship.pai', labelDefault: 'Pai', order: 1, active: true },
  { value: 'mae', labelKey: 'catalog.relationship.mae', labelDefault: 'Mãe', order: 2, active: true },
  { value: 'avo', labelKey: 'catalog.relationship.avo', labelDefault: 'Avô / Avó', order: 3, active: true },
  { value: 'tio', labelKey: 'catalog.relationship.tio', labelDefault: 'Tio / Tia', order: 4, active: true },
  { value: 'irmao', labelKey: 'catalog.relationship.irmao', labelDefault: 'Irmão / Irmã', order: 5, active: true },
  { value: 'tutor_legal', labelKey: 'catalog.relationship.tutor', labelDefault: 'Tutor Legal', order: 6, active: true },
  { value: 'outro', labelKey: 'catalog.relationship.outro', labelDefault: 'Outro', order: 7, active: true },
];

// 12. Divisões Administrativas de Moçambique (11 Províncias e todos os Distritos Oficiais)
export interface ProvinceDefinition {
  nome: string;
  codigo: string;
  pais: string;
  distritos: string[];
}

export const MOZAMBIQUE_PROVINCES: ProvinceDefinition[] = [
  {
    nome: "Maputo Cidade",
    codigo: "MPM",
    pais: "Moçambique",
    distritos: ["KaMpfumo", "KaChamanculo", "KaMaxakeni", "KaMavota", "KaMubukwana", "KaTembe", "KaNyaka"]
  },
  {
    nome: "Maputo Província",
    codigo: "MPL",
    pais: "Moçambique",
    distritos: ["Matola", "Boane", "Magude", "Manhiça", "Marracuene", "Moamba", "Namaacha", "Matutuíne"]
  },
  {
    nome: "Gaza",
    codigo: "GZA",
    pais: "Moçambique",
    distritos: ["Xai-Xai", "Bilene", "Chibuto", "Chicualacuala", "Chigubo", "Chókwè", "Guijá", "Mabalane", "Mandlakazi", "Massangena", "Massingir", "Limpopo", "Chongoene", "Mapai"]
  },
  {
    nome: "Inhambane",
    codigo: "INH",
    pais: "Moçambique",
    distritos: ["Inhambane", "Maxixe", "Funhalouro", "Govuro", "Homoíne", "Inharrime", "Inhassoro", "Jangamo", "Mabote", "Massinga", "Morrumbene", "Panda", "Vilankulo", "Zavala"]
  },
  {
    nome: "Sofala",
    codigo: "SOF",
    pais: "Moçambique",
    distritos: ["Beira", "Búzi", "Caia", "Chemba", "Cheringoma", "Chibabava", "Dondo", "Gorongosa", "Machanga", "Maringué", "Marromeu", "Muanza", "Nhamatanda"]
  },
  {
    nome: "Manica",
    codigo: "MAN",
    pais: "Moçambique",
    distritos: ["Chimoio", "Báruè", "Gondola", "Guro", "Macate", "Machaze", "Macossa", "Manica", "Mossurize", "Sussundenga", "Tambara", "Vanduzi"]
  },
  {
    nome: "Tete",
    codigo: "TET",
    pais: "Moçambique",
    distritos: ["Tete", "Angónia", "Cahora-Bassa", "Changara", "Chifunde", "Chiuta", "Dôa", "Macanga", "Magoé", "Marara", "Marávia", "Moatize", "Mutarara", "Tsangano", "Zumbo"]
  },
  {
    nome: "Zambézia",
    codigo: "ZAM",
    pais: "Moçambique",
    distritos: ["Quelimane", "Alto Molócue", "Chinde", "Derre", "Gilé", "Gurué", "Ile", "Inhassunge", "Lugela", "Maganja da Costa", "Milange", "Mocuba", "Mocubela", "Molumbo", "Mopeia", "Morrumbala", "Mulevala", "Namacurra", "Namarroi", "Nicoadala", "Pebane"]
  },
  {
    nome: "Nampula",
    codigo: "NAM",
    pais: "Moçambique",
    distritos: ["Nampula", "Angoche", "Eráti", "Ilha de Moçambique", "Lalaua", "Larde", "Liúpo", "Malema", "Meconta", "Mecubúri", "Memba", "Mogincual", "Mogovolas", "Moma", "Monapo", "Mossuril", "Muecate", "Murrupula", "Nacala-Porto", "Nacala-a-Velha", "Nacarôa", "Rapale", "Ribáuè"]
  },
  {
    nome: "Cabo Delgado",
    codigo: "CDL",
    pais: "Moçambique",
    distritos: ["Pemba", "Ancuabe", "Balama", "Chiúre", "Ibo", "Macomia", "Mecúfi", "Meluco", "Metuge", "Mocímboa da Praia", "Montepuez", "Mueda", "Muidumbe", "Namuno", "Nangade", "Palma", "Quissanga"]
  },
  {
    nome: "Niassa",
    codigo: "NIA",
    pais: "Moçambique",
    distritos: ["Lichinga", "Cuamba", "Lago", "Lichinga Distrito", "Majune", "Mandimba", "Marrupa", "Maúa", "Mecanhelas", "Mecula", "Metarica", "Muembe", "N'gauma", "Nipepe", "Sanga"]
  }
];

export const ANGOLA_PROVINCES: ProvinceDefinition[] = [
  { nome: "Luanda", codigo: "LUA", pais: "Angola", distritos: ["Luanda", "Belas", "Cacuaco", "Cazenga", "Icolo e Bengo", "Quiçama", "Kilamba Kiaxi", "Talatona", "Viana"] },
  { nome: "Benguela", codigo: "BGL", pais: "Angola", distritos: ["Benguela", "Baía Farta", "Balombo", "Bocoio", "Caimbambo", "Catumbela", "Chongorói", "Cubal", "Ganda", "Lobito"] },
  { nome: "Huambo", codigo: "HMB", pais: "Angola", distritos: ["Huambo", "Bailundo", "Caála", "Catchiungo", "Ekunha", "Londuimbali", "Longonjo", "Mungo", "Tchicala Tcholohanga", "Ucuma", "Chinjenje"] },
  { nome: "Huíla", codigo: "HUL", pais: "Angola", distritos: ["Lubango", "Caconda", "Caluquembe", "Chibia", "Chicomba", "Chipindo", "Cuvango", "Humpata", "Jamba", "Matala", "Quilengues", "Quipungo"] },
  { nome: "Cabinda", codigo: "CAB", pais: "Angola", distritos: ["Cabinda", "Belize", "Buco-Zau", "Cacongo"] }
];

export const PORTUGAL_DISTRICTS: ProvinceDefinition[] = [
  { nome: "Lisboa", codigo: "LIS", pais: "Portugal", distritos: ["Lisboa", "Cascais", "Sintra", "Oeiras", "Amadora", "Odivelas", "Loures", "Vila Franca de Xira", "Torres Vedras", "Mafra"] },
  { nome: "Porto", codigo: "OPO", pais: "Portugal", distritos: ["Porto", "Vila Nova de Gaia", "Matosinhos", "Maia", "Gondomar", "Valongo", "Paredes", "Penafiel", "Santo Tirso", "Vila do Conde", "Póvoa de Varzim"] },
  { nome: "Coimbra", codigo: "COI", pais: "Portugal", distritos: ["Coimbra", "Figueira da Foz", "Cantanhede", "Montemor-o-Velho", "Lousã", "Condeixa-a-Nova"] },
  { nome: "Faro (Algarve)", codigo: "FAR", pais: "Portugal", distritos: ["Faro", "Portimão", "Loulé", "Lagos", "Olhão", "Silves", "Albufeira", "Tavira"] },
  { nome: "Braga", codigo: "BRG", pais: "Portugal", distritos: ["Braga", "Guimarães", "Vila Nova de Famalicão", "Barcelos", "Fafe", "Esposende"] }
];

export const BRAZIL_STATES: ProvinceDefinition[] = [
  { nome: "São Paulo", codigo: "SP", pais: "Brasil", distritos: ["São Paulo", "Campinas", "Guarulhos", "São Bernardo do Campo", "Santo André", "Osasco", "Santos", "Ribeirão Preto"] },
  { nome: "Rio de Janeiro", codigo: "RJ", pais: "Brasil", distritos: ["Rio de Janeiro", "Niterói", "São Gonçalo", "Duque de Caxias", "Nova Iguaçu", "Petrópolis", "Volta Redonda"] },
  { nome: "Minas Gerais", codigo: "MG", pais: "Brasil", distritos: ["Belo Horizonte", "Uberlândia", "Contagem", "Juiz de Fora", "Betim", "Montes Claros"] },
  { nome: "Bahia", codigo: "BA", pais: "Brasil", distritos: ["Salvador", "Feira de Santana", "Vitória da Conquista", "Camaçari", "Itabuna"] }
];

export const SOUTH_AFRICA_PROVINCES: ProvinceDefinition[] = [
  { nome: "Gauteng", codigo: "GP", pais: "África do Sul", distritos: ["Johannesburg", "Pretoria / Tshwane", "Ekurhuleni"] },
  { nome: "Western Cape", codigo: "WC", pais: "África do Sul", distritos: ["Cape Town", "Stellenbosch", "George", "Paarl"] },
  { nome: "KwaZulu-Natal", codigo: "KZN", pais: "África do Sul", distritos: ["Durban / eThekwini", "Pietermaritzburg", "Newcastle"] }
];

/**
 * Obtém as províncias e distritos automáticos com base no país de origem e países de atuação/sucursais.
 */
export function getAutomaticProvincesForCountries(countries: string[]): ProvinceDefinition[] {
  const result: ProvinceDefinition[] = [];
  const normalizedSet = new Set((countries || []).map(c => (c || '').toLowerCase().trim()));

  if (normalizedSet.size === 0 || normalizedSet.has('moçambique') || normalizedSet.has('mocambique') || normalizedSet.has('mozambique')) {
    result.push(...MOZAMBIQUE_PROVINCES);
  }
  if (normalizedSet.has('angola')) {
    result.push(...ANGOLA_PROVINCES);
  }
  if (normalizedSet.has('portugal')) {
    result.push(...PORTUGAL_DISTRICTS);
  }
  if (normalizedSet.has('brasil') || normalizedSet.has('brazil')) {
    result.push(...BRAZIL_STATES);
  }
  if (normalizedSet.has('áfrica do sul') || normalizedSet.has('africa do sul') || normalizedSet.has('south africa')) {
    result.push(...SOUTH_AFRICA_PROVINCES);
  }

  // Garantir que não há duplicatas de províncias
  const seen = new Set<string>();
  return result.filter(p => {
    const key = `${p.pais}_${p.nome}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const WORLD_COUNTRIES = [
  { name: "Moçambique", code: "MZ" },
  { name: "Angola", code: "AO" },
  { name: "Portugal", code: "PT" },
  { name: "Brasil", code: "BR" },
  { name: "Cabo Verde", code: "CV" },
  { name: "Guiné-Bissau", code: "GW" },
  { name: "São Tomé e Príncipe", code: "ST" },
  { name: "Timor-Leste", code: "TL" },
  { name: "África do Sul", code: "ZA" },
  { name: "Espanha", code: "ES" },
  { name: "França", code: "FR" },
  { name: "Alemanha", code: "DE" },
  { name: "Reino Unido", code: "GB" },
  { name: "Estados Unidos", code: "US" },
  { name: "Canadá", code: "CA" },
  { name: "Austrália", code: "AU" },
  { name: "Itália", code: "IT" },
  { name: "Japão", code: "JP" },
  { name: "China", code: "CN" },
  { name: "Índia", code: "IN" },
  { name: "Argentina", code: "AR" },
  { name: "Chile", code: "CL" },
  { name: "Colômbia", code: "CO" },
  { name: "México", code: "MX" },
  { name: "Nigéria", code: "NG" },
  { name: "Quénia", code: "KE" },
  { name: "Senegal", code: "SN" },
  { name: "Gana", code: "GH" },
  { name: "Zâmbia", code: "ZM" },
  { name: "Zimbábue", code: "ZW" },
  { name: "Namíbia", code: "NA" },
  { name: "Suíça", code: "CH" },
  { name: "Bélgica", code: "BE" },
  { name: "Holanda", code: "NL" },
  { name: "Suécia", code: "SE" },
  { name: "Noruega", code: "NO" },
  { name: "Dinamarca", code: "DK" },
  { name: "Finlândia", code: "FI" },
  { name: "Polónia", code: "PL" },
  { name: "Áustria", code: "AT" },
  { name: "Turquia", code: "TR" },
  { name: "Egito", code: "EG" },
  { name: "Emirados Árabes Unidos", code: "AE" },
  { name: "Arábia Saudita", code: "SA" },
  { name: "Cingapura", code: "SG" },
  { name: "Coreia do Sul", code: "KR" },
  { name: "Nova Zelândia", code: "NZ" }
];
