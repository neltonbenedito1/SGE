/**
 * Integrated Local Fallback Database & Sync Engine
 * Stores data locally in localStorage when Firestore is offline or unconfigured (Database not found),
 * and synchronizes with Firestore in the background. Once successfully synced, temporary records are deleted.
 */

import { doc, setDoc, addDoc, collection, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Tenant, Plano, Pagamento, LogAdmin, SmtpConfig, Notificacao } from '../types';

// Local storage keys
const KEYS = {
  TENANTS: 'educas_temp_tenants',
  USERS: 'educas_temp_users',
  CONFIGS: 'educas_temp_configs',
  LOGS: 'educas_temp_logs',
  EMAILS: 'educas_temp_emails',
  NOTIFICATIONS: 'educas_temp_notificacoes',
  PAYMENTS: 'educas_temp_payments',
  SMTP: 'educas_temp_smtp',
  PLANS: 'educas_temp_planos'
};

// Generic Helpers
function getList<T>(key: string): T[] {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : [];
  } catch (e) {
    console.error(`Error reading key ${key} from localStorage:`, e);
    return [];
  }
}

function saveList<T>(key: string, list: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {
    console.error(`Error writing key ${key} to localStorage:`, e);
  }
}

// Exported high-level database operations
export const localDb = {
  // Tenants
  getTenants: () => getList<Tenant>(KEYS.TENANTS),
  saveTenant: (tenant: Tenant) => {
    const list = getList<Tenant>(KEYS.TENANTS);
    const index = list.findIndex(t => t.id === tenant.id);
    if (index >= 0) list[index] = tenant;
    else list.push(tenant);
    saveList(KEYS.TENANTS, list);
  },
  deleteTenant: (id: string) => {
    const list = getList<Tenant>(KEYS.TENANTS).filter(t => t.id !== id);
    saveList(KEYS.TENANTS, list);
  },

  // Users
  getUsers: () => getList<any>(KEYS.USERS),
  saveUser: (user: any) => {
    const list = getList<any>(KEYS.USERS);
    const index = list.findIndex(u => u.id === user.id);
    if (index >= 0) list[index] = user;
    else list.push(user);
    saveList(KEYS.USERS, list);
  },
  deleteUser: (id: string) => {
    const list = getList<any>(KEYS.USERS).filter(u => u.id !== id);
    saveList(KEYS.USERS, list);
  },

  // Configs
  getConfigs: () => getList<any>(KEYS.CONFIGS),
  saveConfig: (config: any) => {
    const list = getList<any>(KEYS.CONFIGS);
    const index = list.findIndex(c => c.id === config.id);
    if (index >= 0) list[index] = config;
    else list.push(config);
    saveList(KEYS.CONFIGS, list);
  },
  deleteConfig: (id: string) => {
    const list = getList<any>(KEYS.CONFIGS).filter(c => c.id !== id);
    saveList(KEYS.CONFIGS, list);
  },

  // Logs
  getLogs: () => getList<LogAdmin>(KEYS.LOGS),
  saveLog: (log: LogAdmin) => {
    const list = getList<LogAdmin>(KEYS.LOGS);
    const index = list.findIndex(l => l.id === log.id);
    if (index >= 0) list[index] = log;
    else list.push(log);
    saveList(KEYS.LOGS, list);
  },
  deleteLog: (id: string) => {
    const list = getList<LogAdmin>(KEYS.LOGS).filter(l => l.id !== id);
    saveList(KEYS.LOGS, list);
  },

  // Emails (Boas-vindas / Notificações pendentes)
  getEmails: () => getList<any>(KEYS.EMAILS),
  saveEmail: (email: any) => {
    const list = getList<any>(KEYS.EMAILS);
    const index = list.findIndex(e => e.id === email.id);
    if (index >= 0) list[index] = email;
    else list.push(email);
    saveList(KEYS.EMAILS, list);
  },
  deleteEmail: (id: string) => {
    const list = getList<any>(KEYS.EMAILS).filter(e => e.id !== id);
    saveList(KEYS.EMAILS, list);
  },

  // Notifications
  getNotifications: () => getList<Notificacao>(KEYS.NOTIFICATIONS),
  saveNotification: (notif: Notificacao) => {
    const list = getList<Notificacao>(KEYS.NOTIFICATIONS);
    const index = list.findIndex(n => n.id === notif.id);
    if (index >= 0) list[index] = notif;
    else list.push(notif);
    saveList(KEYS.NOTIFICATIONS, list);
  },
  deleteNotification: (id: string) => {
    const list = getList<Notificacao>(KEYS.NOTIFICATIONS).filter(n => n.id !== id);
    saveList(KEYS.NOTIFICATIONS, list);
  },

  // Payments
  getPayments: () => getList<Pagamento>(KEYS.PAYMENTS),
  savePayment: (payment: Pagamento) => {
    const list = getList<Pagamento>(KEYS.PAYMENTS);
    const index = list.findIndex(p => p.id === payment.id);
    if (index >= 0) list[index] = payment;
    else list.push(payment);
    saveList(KEYS.PAYMENTS, list);
  },
  deletePayment: (id: string) => {
    const list = getList<Pagamento>(KEYS.PAYMENTS).filter(p => p.id !== id);
    saveList(KEYS.PAYMENTS, list);
  },

  // SmtpConfig
  getSmtpConfigs: () => getList<SmtpConfig>(KEYS.SMTP),
  saveSmtpConfig: (smtp: SmtpConfig) => {
    const list = getList<SmtpConfig>(KEYS.SMTP);
    const index = list.findIndex(s => s.id === smtp.id);
    if (index >= 0) list[index] = smtp;
    else list.push(smtp);
    saveList(KEYS.SMTP, list);
  },
  deleteSmtpConfig: (id: string) => {
    const list = getList<SmtpConfig>(KEYS.SMTP).filter(s => s.id !== id);
    saveList(KEYS.SMTP, list);
  },

  // Plans
  getPlans: () => getList<Plano>(KEYS.PLANS),
  savePlan: (plan: Plano) => {
    const list = getList<Plano>(KEYS.PLANS);
    const index = list.findIndex(p => p.id === plan.id);
    if (index >= 0) list[index] = plan;
    else list.push(plan);
    saveList(KEYS.PLANS, list);
  },
  deletePlan: (id: string) => {
    const list = getList<Plano>(KEYS.PLANS).filter(p => p.id !== id);
    saveList(KEYS.PLANS, list);
  }
};

/**
 * Background synchronizer function.
 * Attempts to push each temporary record in our local database to Firestore.
 * If successful, deletes it from the temporary local storage list.
 */
export async function syncLocalDataToFirestore(): Promise<{
  tenantsSynced: number;
  usersSynced: number;
  configsSynced: number;
  logsSynced: number;
  emailsSynced: number;
  notificationsSynced: number;
  paymentsSynced: number;
  smtpConfigsSynced: number;
  plansSynced: number;
}> {
  const result = {
    tenantsSynced: 0,
    usersSynced: 0,
    configsSynced: 0,
    logsSynced: 0,
    emailsSynced: 0,
    notificationsSynced: 0,
    paymentsSynced: 0,
    smtpConfigsSynced: 0,
    plansSynced: 0
  };

  // Sync Tenants
  const tenants = localDb.getTenants();
  for (const tenant of tenants) {
    try {
      await setDoc(doc(db, 'tenants', tenant.id), tenant);
      localDb.deleteTenant(tenant.id);
      result.tenantsSynced++;
      console.log(`[Sync] Tenant ${tenant.id} successfully synced and removed from temp DB.`);
    } catch (e) {
      console.warn(`[Sync] Failed to sync tenant ${tenant.id}:`, e);
      break; // stop on first failure to preserve order/prevent endless errors
    }
  }

  // Sync Users
  const users = localDb.getUsers();
  for (const user of users) {
    try {
      await setDoc(doc(db, 'users', user.id), user);
      localDb.deleteUser(user.id);
      result.usersSynced++;
      console.log(`[Sync] User ${user.id} successfully synced and removed from temp DB.`);
    } catch (e) {
      console.warn(`[Sync] Failed to sync user ${user.id}:`, e);
      break;
    }
  }

  // Sync Configs
  const configs = localDb.getConfigs();
  for (const config of configs) {
    try {
      await setDoc(doc(db, 'configuracoes', config.id), config);
      localDb.deleteConfig(config.id);
      result.configsSynced++;
      console.log(`[Sync] Configuration ${config.id} successfully synced and removed from temp DB.`);
    } catch (e) {
      console.warn(`[Sync] Failed to sync configuration ${config.id}:`, e);
      break;
    }
  }

  // Sync Logs
  const logs = localDb.getLogs();
  for (const log of logs) {
    try {
      await setDoc(doc(db, 'log_admins', log.id), log);
      localDb.deleteLog(log.id);
      result.logsSynced++;
      console.log(`[Sync] Admin Log ${log.id} successfully synced and removed from temp DB.`);
    } catch (e) {
      console.warn(`[Sync] Failed to sync admin log ${log.id}:`, e);
      break;
    }
  }

  // Sync Notifications
  const notifications = localDb.getNotifications();
  for (const notif of notifications) {
    try {
      // Create copy without id to let firestore assign it, or use setDoc with its ID
      await setDoc(doc(db, 'notificacoes', notif.id), notif);
      localDb.deleteNotification(notif.id);
      result.notificationsSynced++;
      console.log(`[Sync] Notification ${notif.id} successfully synced and removed from temp DB.`);
    } catch (e) {
      console.warn(`[Sync] Failed to sync notification ${notif.id}:`, e);
      break;
    }
  }

  // Sync Payments
  const payments = localDb.getPayments();
  for (const payment of payments) {
    try {
      await setDoc(doc(db, 'pagamentos', payment.id), payment);
      localDb.deletePayment(payment.id);
      result.paymentsSynced++;
      console.log(`[Sync] Payment ${payment.id} successfully synced and removed from temp DB.`);
    } catch (e) {
      console.warn(`[Sync] Failed to sync payment ${payment.id}:`, e);
      break;
    }
  }

  // Sync SMTP Configs
  const smtps = localDb.getSmtpConfigs();
  for (const smtp of smtps) {
    try {
      await setDoc(doc(db, 'smtp_configs', smtp.id), smtp);
      localDb.deleteSmtpConfig(smtp.id);
      result.smtpConfigsSynced++;
      console.log(`[Sync] SMTP Config ${smtp.id} successfully synced and removed from temp DB.`);
    } catch (e) {
      console.warn(`[Sync] Failed to sync SMTP config ${smtp.id}:`, e);
      break;
    }
  }

  // Sync Plans
  const plans = localDb.getPlans();
  for (const plan of plans) {
    try {
      await setDoc(doc(db, 'planos', plan.id), plan);
      localDb.deletePlan(plan.id);
      result.plansSynced++;
      console.log(`[Sync] Plan ${plan.id} successfully synced and removed from temp DB.`);
    } catch (e) {
      console.warn(`[Sync] Failed to sync plan ${plan.id}:`, e);
      break;
    }
  }

  return result;
}
