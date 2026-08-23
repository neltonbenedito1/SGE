/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const LANGUAGES = [
  { code: "pt", name: "Português", flag: "🇵🇹" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "ru", name: "Русский", flag: "🇷🇺" },
  { code: "ar", name: "العربية", flag: "🇸🇦" },
];

export type LanguageCode = string;

// Standard UI dictionary translations
export const DICTIONARY: Record<string, Record<LanguageCode, string>> = {
  "Portal de Acesso Educacional": {
    pt: "Portal de Acesso Educacional",
    en: "Educational Access Portal",
    es: "Portal de Acceso Educativo",
    fr: "Portail d'Accès Éducatif",
    de: "Bildungszugangsportal",
    it: "Portale di Accesso Educativo",
    zh: "教育准入门户",
    ja: "教育アクセスウェブサイト",
    ru: "Образовательный портал доступа",
    ar: "بوابة الوصول التعليمي"
  },
  "Sistema SaaS multi-tenant. Faça o login único abaixo ou registre sua própria escola.": {
    pt: "Sistema SaaS multi-tenant. Faça o login único abaixo ou registre sua própria escola.",
    en: "Multi-tenant SaaS system. Log in below or register your own school.",
    es: "Sistema SaaS multi-tenant. Inicie sesión a continuación o registre su propia escuela.",
    fr: "Système SaaS multi-locataire. Connectez-vous ci-dessous ou inscrivez votre propre école.",
    de: "Multi-Tenant-SaaS-System. Melden Sie sich unten an oder registrieren Sie Ihre eigene Schule.",
    it: "Sistema SaaS multi-tenant. Accedi qui sotto o registra la tua scuola.",
    zh: "多租户 SaaS 系统。在下方登录或注册您自己的学校。",
    ja: "マルチテナントSaaSシステム。以下からログインするか、独自の学校を登録してください。",
    ru: "Мультиарендная система SaaS. Войдите ниже или зарегистрируйте свою школу.",
    ar: "نظام SaaS متعدد المستأجرين. قم بتسجيل الدخول أدناه أو تسجيل مدرستك الخاصة."
  },
  "Registrar Escola (Sign-up)": {
    pt: "Registrar Escola (Sign-up)",
    en: "Register School (Sign-up)",
    es: "Registrar Escuela (Registrarse)",
    fr: "Inscrire une École (S'inscrire)",
    de: "Schule registrieren",
    it: "Registra Scuola (Iscriviti)",
    zh: "注册学校（注册）",
    ja: "学校の登録（サインアップ）",
    ru: "Зарегистрировать школу (Регистрация)",
    ar: "تسجيل المدرسة (اشتراك)"
  },
  "Acesso Unificado ao Sistema": {
    pt: "Acesso Unificado ao Sistema",
    en: "Unified System Access",
    es: "Acceso Unificado al Sistema",
    fr: "Accès au Système Unique",
    de: "Einheitlicher Systemzugriff",
    it: "Accesso al Sistema Unificato",
    zh: "统一系统访问",
    ja: "統合システムアクセス",
    ru: "Единый доступ к системе",
    ar: "الوصول الموحد إلى النظام"
  },
  "Informe suas credenciais para ser redirecionado automaticamente.": {
    pt: "Informe suas credenciais para ser redirecionado automaticamente.",
    en: "Enter your credentials to be redirected automatically.",
    es: "Ingrese sus credenciales para ser redireccionado automáticamente.",
    fr: "Entrez vos identifiants pour être redirigé automatiquement.",
    de: "Geben Sie Ihre Zugangsdaten ein, um automatisch weitergeleitet zu werden.",
    it: "Inserisci le tue credenziali per essere reindirizzato automaticamente.",
    zh: "输入您的凭据即可自动重定向。",
    ja: "認証情報を入力すると、自動的にリダイレクトされます。",
    ru: "Введите свои учетные данные для автоматического перенаправления.",
    ar: "أدخل بيانات الاعتماد الخاصة بك ليتم إعادة توجيهك تلقائيًا."
  },
  "Endereço de E-mail": {
    pt: "Endereço de E-mail",
    en: "Email Address",
    es: "Dirección de Correo Electrónico",
    fr: "Adresse E-mail",
    de: "E-Mail-Adresse",
    it: "Indirizzo E-mail",
    zh: "电子邮件地址",
    ja: "メールアドレス",
    ru: "Адрес электронной почты",
    ar: "عنوان البريد الإلكتروني"
  },
  "Senha de Acesso": {
    pt: "Senha de Acesso",
    en: "Access Password",
    es: "Contraseña de Acceso",
    fr: "Mot de Passe d'Accès",
    de: "Passwort",
    it: "Password di Accesso",
    zh: "访问密码",
    ja: "アクセスパスワード",
    ru: "Пароль доступа",
    ar: "كلمة مرور الوصول"
  },
  "Autenticar e Entrar": {
    pt: "Autenticar e Entrar",
    en: "Authenticate & Enter",
    es: "Autenticar e Ingresar",
    fr: "S'authentifier & Entrer",
    de: "Authentifizieren & Anmelden",
    it: "Autenticati ed Entra",
    zh: "身份验证并进入",
    ja: "認証して入力",
    ru: "Авторизоваться и войти",
    ar: "المصادقة والدخول"
  },
  "Credenciais rápidas para testes:": {
    pt: "🔑 Credenciais Rápidas para Testes:",
    en: "🔑 Quick Testing Credentials:",
    es: "🔑 Credenciales de Prueba Rápidas:",
    fr: "🔑 Identifiants de Test Rapides:",
    de: "🔑 Schnelle Test-Anmeldeinformationen:",
    it: "🔑 Credenziali di Test Rapide:",
    zh: "🔑 快速测试凭证：",
    ja: "🔑 クイックテスト認証情報：",
    ru: "🔑 Быстрые учетные данные для тестирования:",
    ar: "🔑 بيانات اعتماد الاختبار السريع:"
  },
  "Credenciais inválidas": {
    pt: "Credenciais inválidas",
    en: "Invalid credentials",
    es: "Credenciales inválidas",
    fr: "Identifiants invalides",
    de: "Ungültige Anmeldedaten",
    it: "Credenziali non valide",
    zh: "凭证无效",
    ja: "資格情報が無効です",
    ru: "Неверные учетные данные",
    ar: "بيانات الاعتماد غير صالحة"
  },
  "Quer testar a criação instantânea de uma nova escola?": {
    pt: "Quer testar a criação instantânea de uma nova escola?",
    en: "Want to test instant creation of a new school?",
    es: "¿Quieres probar la creación instantánea de una nueva escuela?",
    fr: "Vous voulez tester la création instantanée d'une nouvelle école ?",
    de: "Möchten Sie die sofortige Erstellung einer neuen Schule testen?",
    it: "Vuoi testare la creazione istantanea di una nuova scuola?",
    zh: "想测试即时创建新学校吗？",
    ja: "新しい学校の即時作成をテストしたいですか？",
    ru: "Хотите протестировать мгновенное создание новой школы?",
    ar: "هل تريد اختبار الإنشاء الفوري لمدرسة جديدة؟"
  },
  "Registrar Escola Agora": {
    pt: "Registrar Escola Agora",
    en: "Register School Now",
    es: "Registrar Escuela Ahora",
    fr: "Inscrire une École Maintenant",
    de: "Schule jetzt registrieren",
    it: "Registra la Scuola Ora",
    zh: "立即注册学校",
    ja: "今すぐ学校を登録する",
    ru: "Зарегистрировать школу сейчас",
    ar: "سجل مدرستك الآن"
  },
  "Painel super admin": {
    pt: "Painel Super Admin",
    en: "Super Admin Panel",
    es: "Panel Super Admin",
    fr: "Panneau Super Admin",
    de: "Super-Admin-Panel",
    it: "Pannello Super Admin",
    zh: "超级管理员面板",
    ja: "スーパー管理者パネル",
    ru: "Панель суперадминистратора",
    ar: "لوحة المسؤول الفائق"
  },
  "Dashboard Global": {
    pt: "Dashboard Global",
    en: "Global Dashboard",
    es: "Tablero Global",
    fr: "Tableau de Bord Global",
    de: "Globales Dashboard",
    it: "Dashboard Globale",
    zh: "全球仪表板",
    ja: "グローバルダッシュボード",
    ru: "Глобальная панель",
    ar: "لوحة القيادة العالمية"
  },
  "Contas & Clientes": {
    pt: "Contas & Clientes",
    en: "Accounts & Clients",
    es: "Cuentas y Clientes",
    fr: "Comptes & Clients",
    de: "Konten & Kunden",
    it: "Conti & Clienti",
    zh: "账户与客户",
    ja: "アカウントとクライアント",
    ru: "Учетные записи и клиенты",
    ar: "الحسابات والعملاء"
  },
  "Planos & Limites": {
    pt: "Planos & Limites",
    en: "Plans & Limits",
    es: "Planes y Límites",
    fr: "Forfaits & Limites",
    de: "Tarife & Limits",
    it: "Piani & Limiti",
    zh: "计划与限制",
    ja: "プランと制限",
    ru: "Планы и лимиты",
    ar: "الخطط والحدود"
  },
  "Histórico Pagamentos": {
    pt: "Histórico Pagamentos",
    en: "Payment History",
    es: "Historial de Pagos",
    fr: "Historique des Paiements",
    de: "Zahlungsverlauf",
    it: "Cronologia Pagamenti",
    zh: "付款历史",
    ja: "支払い履歴",
    ru: "История платежей",
    ar: "تاريخ الدفع"
  },
  "Servidores SMTP": {
    pt: "Servidores SMTP",
    en: "SMTP Servers",
    es: "Servidores SMTP",
    fr: "Serveurs SMTP",
    de: "SMTP-Server",
    it: "Server SMTP",
    zh: "SMTP 服务器",
    ja: "SMTPサーバー",
    ru: "Серверы SMTP",
    ar: "خوادم SMTP"
  },
  "Config. Notificações": {
    pt: "Config. Notificações",
    en: "Notification Configs",
    es: "Config. de Notificaciones",
    fr: "Config. des Notifications",
    de: "Benachrichtigungskonf.",
    it: "Config. Notifiche",
    zh: "通知配置",
    ja: "通知設定",
    ru: "Конфиг. уведомлений",
    ar: "تكوين الإخطارات"
  },
  "Auditoria Geral": {
    pt: "Auditoria Geral",
    en: "General Audit",
    es: "Auditoría General",
    fr: "Audit Général",
    de: "Allgemeines Audit",
    it: "Audit Generale",
    zh: "一般审计",
    ja: "一般監査",
    ru: "Общий аудит",
    ar: "تدقيق عام"
  },
  "Logs Criptografados": {
    pt: "Logs Criptografados",
    en: "Encrypted Logs",
    es: "Registros Encriptados",
    fr: "Journaux Chiffrés",
    de: "Verschlüsselte Protokolle",
    it: "Log Crittografati",
    zh: "加密日志",
    ja: "暗号化されたログ",
    ru: "Зашифрованные логи",
    ar: "السجلات المشفرة"
  },
  "Contas Admin - Configuracoes gerais": {
    pt: "Contas Admin - Configurações Gerais",
    en: "Admin Accounts - General Settings",
    es: "Cuentas de Admin - Configuración General",
    fr: "Comptes d'Admin - Paramètres Généraux",
    de: "Admin-Konten - Allgemeine Einstellungen",
    it: "Conti Admin - Impostazioni Generali",
    zh: "管理账户 - 通用设置",
    ja: "管理アカウント- 一般設定",
    ru: "Административные аккаунты - Общие настройки",
    ar: "حسابات المسؤول - الإعدادات العامة"
  },
  "Utilizadores - Conficuracoes gerais": {
    pt: "Utilizadores - Configurações Gerais",
    en: "Users - General Settings",
    es: "Usuarios - Configuración General",
    fr: "Utilisateurs - Paramètres Généraux",
    de: "Benutzer - Allgemeine Einstellungen",
    it: "Utenti - Impostazioni Generali",
    zh: "用户 - 通用设置",
    ja: "ユーザー - 一般設定",
    ru: "Пользователи - Общие настройки",
    ar: "المستخدمون - الإعدادات العامة"
  },
  "Configurações Gerais da Unidade": {
    pt: "Configurações Gerais da Unidade",
    en: "General School Settings",
    es: "Configuración General de la Unidad",
    fr: "Paramètres Généraux de l'Établissement",
    de: "Allgemeine Einstellungen der Einheit",
    it: "Impostazioni Generali dell'Unità",
    zh: "机构通用设置",
    ja: "学校の一般設定",
    ru: "Общие настройки учебного заведения",
    ar: "الإعدادات العامة للوحدة"
  },
  "Administração de Utilizadores": {
    pt: "Administração de Utilizadores",
    en: "User Administration",
    es: "Administración de Usuarios",
    fr: "Administration des Utilisateurs",
    de: "Benutzerverwaltung",
    it: "Amministrazione Utenti",
    zh: "用户管理",
    ja: "ユーザー管理",
    ru: "Управление пользователями",
    ar: "إدارة المستخدمين"
  }
};

import i18n from '../i18n';

// Local storage keys
const LANG_STORAGE_KEY = "saas_educ_system_lang";
const CACHE_STORAGE_KEY = "saas_educ_system_lang_cache";

// Retrieve active language
export function getSystemLanguage(): string {
  const saved = localStorage.getItem(LANG_STORAGE_KEY);
  return saved || "pt";
}

// Set active language
export function setSystemLanguage(lang: string): void {
  localStorage.setItem(LANG_STORAGE_KEY, lang);
  i18n.changeLanguage(lang).catch(err => {
    console.warn("i18n language change failed in setSystemLanguage bridge:", err);
  });
  try {
    window.dispatchEvent(new Event("languagechange"));
  } catch (e) {
    try {
      const evt = document.createEvent('Event');
      evt.initEvent("languagechange", true, true);
      window.dispatchEvent(evt);
    } catch (err) {
      console.warn("Could not dispatch languagechange event", err);
    }
  }
}

// Memory and persistent cache for dynamic AI translation
let translationCache: Record<string, Record<string, string>> = {};
try {
  const cached = localStorage.getItem(CACHE_STORAGE_KEY);
  if (cached) {
    translationCache = JSON.parse(cached);
  }
} catch (e) {
  console.error("Failed to load translation cache", e);
}

function saveTranslationToCache(text: string, lang: string, translated: string) {
  if (!translationCache[lang]) {
    translationCache[lang] = {};
  }
  translationCache[lang][text] = translated;
  try {
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(translationCache));
  } catch (e) {
    console.error("Failed to save translation cache", e);
  }
}

// Main translation function
export function translate(text: string, customLang?: string): string {
  if (!text) return "";
  const lang = customLang || getSystemLanguage();
  
  // 1. Try i18next first
  // Translate keys directly if they exist in namespaces
  if (i18n.exists(text, { lng: lang })) {
    return i18n.t(text, { lng: lang });
  }

  // 2. Also map standard sentences if they are defined in 'common' under a sanitized key format or direct key lookup
  const cleanKey = text.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/(^_+|_+$)/g, '');
  if (i18n.exists(`common:${cleanKey}`, { lng: lang })) {
    return i18n.t(`common:${cleanKey}`, { lng: lang });
  }

  if (lang === "pt") return text; // Default is Portuguese

  // 3. Look up in static dictionary
  const dictMatch = DICTIONARY[text];
  if (dictMatch && dictMatch[lang]) {
    return dictMatch[lang];
  }

  // 4. Look up in dynamic AI translation cache
  if (translationCache[lang] && translationCache[lang][text]) {
    return translationCache[lang][text];
  }

  // 5. Fallback to original text immediately (background translator will fetch it asynchronously)
  return text;
}

// Background AI translation executor
export async function fetchAiTranslation(text: string, targetLanguageCode: string): Promise<string> {
  const targetLanguage = LANGUAGES.find(l => l.code === targetLanguageCode)?.name || targetLanguageCode;
  
  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        targetLanguage,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.translatedText) {
        saveTranslationToCache(text, targetLanguageCode, data.translatedText);
        return data.translatedText;
      }
    }
  } catch (err) {
    console.error("Failed to fetch background AI translation:", err);
  }

  return text;
}
