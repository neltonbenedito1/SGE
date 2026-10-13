/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdminInstance, getFirestoreInstance } from '../middleware/auth';

export interface AuditLogEntry {
  actor_id: string;
  actor_email: string;
  actor_role: string;
  action: 'create' | 'update' | 'delete' | 'status_change' | 'permission_change' | 'login' | 'logout' | 'password_reset' | 'payment' | 'grade_published';
  entity: string;
  entity_id: string;
  tenant_id: string;
  before_state?: any;
  after_state?: any;
  metadata?: Record<string, any>;
  ip?: string;
  user_agent?: string;
}

/**
 * Appends an immutable audit log record to the `audit_logs` collection.
 */
export async function recordAuditLog(entry: AuditLogEntry): Promise<string> {
  try {
    const db = getFirestoreInstance();

    const docId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const record = {
      id: docId,
      actor_id: entry.actor_id || 'system',
      actor_email: entry.actor_email || 'system',
      actor_role: entry.actor_role || 'system',
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entity_id,
      tenant_id: entry.tenant_id || 'global',
      before_state: entry.before_state ? JSON.stringify(entry.before_state) : null,
      after_state: entry.after_state ? JSON.stringify(entry.after_state) : null,
      metadata: entry.metadata || {},
      ip: entry.ip || '',
      user_agent: entry.user_agent || '',
      timestamp: new Date().toISOString(),
      server_timestamp: FieldValue.serverTimestamp(),
    };

    await db.collection('audit_logs').doc(docId).set(record);
    return docId;
  } catch (err) {
    console.error('[AuditLog] Failed to record immutable audit entry:', err);
    return '';
  }
}
