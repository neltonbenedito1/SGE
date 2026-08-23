import { addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Notificacao } from '../types';
import { sendBrowserNotification } from '../lib/browserNotifications';

export interface BaseNotificationPayload {
  tenant_id: string;
  titulo: string;
  mensagem: string;
  tipo?: 'info' | 'alerta' | 'limite' | 'sistema' | 'sucesso' | 'cadastro';
  modulo?: string;
  link?: string;
}

export interface UserTarget {
  id?: string;
  user_id?: string;
  email?: string;
  nome?: string;
  role?: 'admin' | 'director' | 'docente' | 'estudante' | 'pai' | 'todos' | string;
}

/**
 * Dispatches a notification to Firestore and optionally triggers browser push notification.
 */
export async function sendAppNotification(
  payload: BaseNotificationPayload & {
    destinatario_id: string;
    destinatario_role?: string;
    destinatario_email?: string;
    usuario_id?: string;
    estudante_id?: string;
    docente_id?: string;
    turma_id?: string;
    turma_nome?: string;
    escola_id?: string;
    disciplina_id?: string;
    disciplina_nome?: string;
    atividade_id?: string;
    exame_id?: string;
    processo_id?: string;
  }
): Promise<string | null> {
  try {
    const docData = {
      tenant_id: payload.tenant_id || '',
      destinatario_id: payload.destinatario_id,
      destinatario_role: payload.destinatario_role || 'todos',
      destinatario_email: payload.destinatario_email || '',
      usuario_id: payload.usuario_id || payload.destinatario_id,
      estudante_id: payload.estudante_id || '',
      docente_id: payload.docente_id || '',
      turma_id: payload.turma_id || '',
      turma_nome: payload.turma_nome || '',
      escola_id: payload.escola_id || '',
      disciplina_id: payload.disciplina_id || '',
      disciplina_nome: payload.disciplina_nome || '',
      atividade_id: payload.atividade_id || '',
      exame_id: payload.exame_id || '',
      processo_id: payload.processo_id || '',
      titulo: payload.titulo,
      mensagem: payload.mensagem,
      tipo: payload.tipo || 'info',
      modulo: payload.modulo || 'geral',
      link: payload.link || '',
      lido: false,
      created_at: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, 'notificacoes'), docData);

    // Optional browser push notification
    try {
      sendBrowserNotification({
        title: payload.titulo,
        body: payload.mensagem,
        tag: `notif-${docRef.id}`
      });
    } catch {
      // Ignore if browser permission denied
    }

    return docRef.id;
  } catch (error) {
    console.error('[NotificationDispatcher] Erro ao despachar notificação:', error);
    return null;
  }
}

/**
 * Dispatch notification for a new or updated Class Schedule (Horário de Aula / Agendamento)
 */
export async function notifyScheduleCreatedOrUpdated(params: {
  tenant_id: string;
  turma_id: string;
  turma_nome: string;
  disciplina_nome: string;
  docente_id?: string;
  docente_nome?: string;
  docente_user_id?: string;
  data_aula?: string;
  hora_inicio: string;
  hora_fim: string;
  sala?: string;
  students?: Array<{ id: string; user_id?: string; pai_id?: string; pai_email?: string; nome?: string }>;
  isUpdate?: boolean;
}) {
  const {
    tenant_id,
    turma_id,
    turma_nome,
    disciplina_nome,
    docente_id,
    docente_user_id,
    data_aula,
    hora_inicio,
    hora_fim,
    sala,
    students = [],
    isUpdate = false
  } = params;

  const actionText = isUpdate ? 'atualizado' : 'agendado';
  const title = `📅 Horário de Aula ${actionText}: ${disciplina_nome}`;
  const details = `${disciplina_nome} na turma ${turma_nome}${data_aula ? ` para ${data_aula}` : ''} (${hora_inicio} - ${hora_fim})${sala ? ` na ${sala}` : ''}.`;

  const promises: Promise<any>[] = [];

  // 1. Notify the assigned teacher
  if (docente_user_id || docente_id) {
    promises.push(
      sendAppNotification({
        tenant_id,
        destinatario_id: docente_user_id || docente_id!,
        destinatario_role: 'docente',
        docente_id: docente_id || '',
        turma_id,
        turma_nome,
        disciplina_nome,
        titulo: title,
        mensagem: `Foi ${actionText} o seu horário de ${details}`,
        tipo: 'info',
        modulo: 'horarios'
      })
    );
  }

  // 2. Notify the Turma (all students in class)
  promises.push(
    sendAppNotification({
      tenant_id,
      destinatario_id: turma_id,
      destinatario_role: 'estudante',
      turma_id,
      turma_nome,
      disciplina_nome,
      titulo: title,
      mensagem: `Novo horário de aula ${details}`,
      tipo: 'info',
      modulo: 'horarios'
    })
  );

  // 3. Notify each student individually and their parents
  for (const s of students) {
    if (s.user_id || s.id) {
      promises.push(
        sendAppNotification({
          tenant_id,
          destinatario_id: s.user_id || s.id,
          destinatario_role: 'estudante',
          estudante_id: s.id,
          turma_id,
          turma_nome,
          disciplina_nome,
          titulo: title,
          mensagem: `Atenção: Horário de aula ${details}`,
          tipo: 'info',
          modulo: 'horarios'
        })
      );
    }
    if (s.pai_id || s.pai_email) {
      promises.push(
        sendAppNotification({
          tenant_id,
          destinatario_id: s.pai_id || s.pai_email!,
          destinatario_role: 'pai',
          destinatario_email: s.pai_email || '',
          estudante_id: s.id,
          turma_id,
          turma_nome,
          disciplina_nome,
          titulo: `📅 Horário de Aula (${s.nome || 'Educando'})`,
          mensagem: `Informamos que foi ${actionText} o horário de ${details}`,
          tipo: 'info',
          modulo: 'horarios'
        })
      );
    }
  }

  await Promise.allSettled(promises);
}

/**
 * Dispatch notification for an Exam/Evaluation Schedule (Agendamento de Exame / Teste)
 */
export async function notifyExamScheduled(params: {
  tenant_id: string;
  turma_id: string;
  turma_nome: string;
  disciplina_nome: string;
  tipo_exame: string;
  data_exame: string;
  hora_inicio: string;
  hora_fim: string;
  sala?: string;
  docente_id?: string;
  docente_user_id?: string;
  students?: Array<{ id: string; user_id?: string; pai_id?: string; pai_email?: string; nome?: string }>;
  isUpdate?: boolean;
}) {
  const {
    tenant_id,
    turma_id,
    turma_nome,
    disciplina_nome,
    tipo_exame,
    data_exame,
    hora_inicio,
    hora_fim,
    sala,
    docente_id,
    docente_user_id,
    students = [],
    isUpdate = false
  } = params;

  const actionText = isUpdate ? 'alterado' : 'marcado';
  const title = `📝 Avaliação/Exame ${actionText}: ${disciplina_nome}`;
  const details = `${tipo_exame} de ${disciplina_nome} para a turma ${turma_nome} no dia ${data_exame} das ${hora_inicio} às ${hora_fim}${sala ? ` na ${sala}` : ''}.`;

  const promises: Promise<any>[] = [];

  // 1. Notify Teacher
  if (docente_user_id || docente_id) {
    promises.push(
      sendAppNotification({
        tenant_id,
        destinatario_id: docente_user_id || docente_id!,
        destinatario_role: 'docente',
        docente_id: docente_id || '',
        turma_id,
        turma_nome,
        disciplina_nome,
        titulo: title,
        mensagem: `Você tem uma avaliação agendada: ${details}`,
        tipo: 'alerta',
        modulo: 'exames'
      })
    );
  }

  // 2. Notify Turma
  promises.push(
    sendAppNotification({
      tenant_id,
      destinatario_id: turma_id,
      destinatario_role: 'estudante',
      turma_id,
      turma_nome,
      disciplina_nome,
      titulo: title,
      mensagem: `Atenção: ${details} Prepare-se!`,
      tipo: 'alerta',
      modulo: 'exames'
    })
  );

  // 3. Notify individual students and parents
  for (const s of students) {
    if (s.user_id || s.id) {
      promises.push(
        sendAppNotification({
          tenant_id,
          destinatario_id: s.user_id || s.id,
          destinatario_role: 'estudante',
          estudante_id: s.id,
          turma_id,
          turma_nome,
          disciplina_nome,
          titulo: title,
          mensagem: `Atenção estudante: ${details}`,
          tipo: 'alerta',
          modulo: 'exames'
        })
      );
    }
    if (s.pai_id || s.pai_email) {
      promises.push(
        sendAppNotification({
          tenant_id,
          destinatario_id: s.pai_id || s.pai_email!,
          destinatario_role: 'pai',
          destinatario_email: s.pai_email || '',
          estudante_id: s.id,
          turma_id,
          turma_nome,
          disciplina_nome,
          titulo: `📝 Agendamento de Exame: ${s.nome || 'Educando'}`,
          mensagem: `Informamos que foi marcado: ${details}`,
          tipo: 'alerta',
          modulo: 'exames'
        })
      );
    }
  }

  await Promise.allSettled(promises);
}

/**
 * Dispatch notification for Grade / Pauta Publication or Retification
 */
export async function notifyGradePublished(params: {
  tenant_id: string;
  estudante_id: string;
  estudante_user_id?: string;
  estudante_nome: string;
  pai_id?: string;
  pai_email?: string;
  disciplina_nome: string;
  nota_media: number | string;
  situacao: string;
  isRetificacao?: boolean;
}) {
  const {
    tenant_id,
    estudante_id,
    estudante_user_id,
    estudante_nome,
    pai_id,
    pai_email,
    disciplina_nome,
    nota_media,
    situacao,
    isRetificacao = false
  } = params;

  const title = isRetificacao ? '📊 Nota de Pauta Retificada' : '📊 Nova Nota de Pauta Publicada';
  const msgStudent = `A sua nota na disciplina "${disciplina_nome}" foi ${isRetificacao ? 'retificada' : 'publicada'}. Média Final: ${nota_media} valores (${situacao}).`;
  const msgParent = `A nota de ${estudante_nome} na disciplina "${disciplina_nome}" foi lançada: ${nota_media} valores (${situacao}).`;

  const promises: Promise<any>[] = [];

  // Notify student
  if (estudante_user_id || estudante_id) {
    promises.push(
      sendAppNotification({
        tenant_id,
        destinatario_id: estudante_user_id || estudante_id,
        destinatario_role: 'estudante',
        estudante_id,
        titulo: title,
        mensagem: msgStudent,
        tipo: 'sucesso',
        modulo: 'pautas'
      })
    );
  }

  // Notify parent
  if (pai_id || pai_email) {
    promises.push(
      sendAppNotification({
        tenant_id,
        destinatario_id: pai_id || pai_email!,
        destinatario_role: 'pai',
        destinatario_email: pai_email || '',
        estudante_id,
        titulo: `📊 Nota Escolar: ${estudante_nome}`,
        mensagem: msgParent,
        tipo: 'info',
        modulo: 'pautas'
      })
    );
  }

  // Notify admin
  promises.push(
    sendAppNotification({
      tenant_id,
      destinatario_id: tenant_id,
      destinatario_role: 'admin',
      estudante_id,
      titulo: title,
      mensagem: `Lançada nota de ${estudante_nome} em "${disciplina_nome}": ${nota_media} valores (${situacao}).`,
      tipo: 'sucesso',
      modulo: 'pautas'
    })
  );

  await Promise.allSettled(promises);
}

/**
 * Dispatch notification for Attendance Log (Falta, Atraso, Presença)
 */
export async function notifyAttendanceLogged(params: {
  tenant_id: string;
  registro_id: string;
  user_id?: string;
  nome: string;
  tipo: 'estudante' | 'docente';
  status: 'falta' | 'atrasado' | 'presente' | 'justificado';
  data_registro: string;
  turma_nome?: string;
  pai_id?: string;
  pai_email?: string;
}) {
  const {
    tenant_id,
    registro_id,
    user_id,
    nome,
    tipo,
    status,
    data_registro,
    turma_nome,
    pai_id,
    pai_email
  } = params;

  if (status === 'presente') return; // Do not spam for normal presence

  const isFalta = status === 'falta';
  const statusLabel = isFalta ? 'FALTA NÃO JUSTIFICADA' : 'CHEGADA EM ATRASO';
  const emoji = isFalta ? '🚨' : '⏰';
  const notifType = isFalta ? 'alerta' : 'info';

  const promises: Promise<any>[] = [];

  // Notify the user (student or teacher)
  if (user_id || registro_id) {
    promises.push(
      sendAppNotification({
        tenant_id,
        destinatario_id: user_id || registro_id,
        destinatario_role: tipo,
        estudante_id: tipo === 'estudante' ? registro_id : undefined,
        docente_id: tipo === 'docente' ? registro_id : undefined,
        titulo: `${emoji} Registo de Assiduidade: ${statusLabel}`,
        mensagem: `Foi registrada uma ${statusLabel.toLowerCase()} no dia ${data_registro}${turma_nome ? ` (Turma: ${turma_nome})` : ''}.`,
        tipo: notifType,
        modulo: 'assiduidade'
      })
    );
  }

  // If student, notify the parent
  if (tipo === 'estudante' && (pai_id || pai_email)) {
    promises.push(
      sendAppNotification({
        tenant_id,
        destinatario_id: pai_id || pai_email!,
        destinatario_role: 'pai',
        destinatario_email: pai_email || '',
        estudante_id: registro_id,
        titulo: `${emoji} Alerta de Assiduidade: ${nome}`,
        mensagem: `Informamos que foi registrada uma ${statusLabel.toLowerCase()} para ${nome} no dia ${data_registro}${turma_nome ? ` (${turma_nome})` : ''}.`,
        tipo: notifType,
        modulo: 'assiduidade'
      })
    );
  }

  await Promise.allSettled(promises);
}

/**
 * Dispatch notification for Absence Justification evaluation
 */
export async function notifyJustificationEvaluated(params: {
  tenant_id: string;
  estudante_id: string;
  estudante_user_id?: string;
  estudante_nome: string;
  pai_id?: string;
  pai_email?: string;
  data_falta: string;
  action: 'validada' | 'rejeitada';
}) {
  const {
    tenant_id,
    estudante_id,
    estudante_user_id,
    estudante_nome,
    pai_id,
    pai_email,
    data_falta,
    action
  } = params;

  const isValid = action === 'validada';
  const title = isValid ? '✅ Justificativa de Falta Aprovada' : '❌ Justificativa de Falta Rejeitada';
  const msg = isValid
    ? `A sua justificativa para a falta de ${data_falta} foi aprovada e a falta foi retirada.`
    : `A sua justificativa para a falta de ${data_falta} foi indeferida/rejeitada pela direção. A falta permanece.`;

  const promises: Promise<any>[] = [];

  if (estudante_user_id || estudante_id) {
    promises.push(
      sendAppNotification({
        tenant_id,
        destinatario_id: estudante_user_id || estudante_id,
        destinatario_role: 'estudante',
        estudante_id,
        titulo: title,
        mensagem: msg,
        tipo: isValid ? 'sucesso' : 'alerta',
        modulo: 'assiduidade'
      })
    );
  }

  if (pai_id || pai_email) {
    promises.push(
      sendAppNotification({
        tenant_id,
        destinatario_id: pai_id || pai_email!,
        destinatario_role: 'pai',
        destinatario_email: pai_email || '',
        estudante_id,
        titulo: `${title} (${estudante_nome})`,
        mensagem: `A justificativa de falta do estudante ${estudante_nome} referente a ${data_falta} foi ${isValid ? 'aprovada' : 'rejeitada'}.`,
        tipo: isValid ? 'sucesso' : 'alerta',
        modulo: 'assiduidade'
      })
    );
  }

  await Promise.allSettled(promises);
}

/**
 * Dispatch notification for Activity / Task Assigned or Updated
 */
export async function notifyActivityAssigned(params: {
  tenant_id: string;
  atividade_id?: string;
  actividade_id?: string;
  titulo?: string;
  titulo_atividade?: string;
  detalhes?: string;
  tipo_atividade?: string;
  data_prazo?: string;
  data_entrega?: string;
  responsavel_id?: string;
  responsavel_nome?: string;
  atribuido_a_id?: string;
  atribuido_a_nome?: string;
  atribuido_a_role?: string;
  categoria_atribuicao?: string;
  severidade?: string;
  turma_id?: string;
  turma_nome?: string;
  criador_nome?: string;
  criado_por_nome?: string;
  isUpdate?: boolean;
}) {
  const {
    tenant_id,
    atividade_id,
    actividade_id,
    titulo,
    titulo_atividade,
    detalhes,
    tipo_atividade,
    data_prazo,
    data_entrega,
    responsavel_id,
    responsavel_nome,
    atribuido_a_id,
    atribuido_a_nome,
    atribuido_a_role,
    categoria_atribuicao,
    severidade,
    turma_id,
    turma_nome,
    criador_nome,
    criado_por_nome,
    isUpdate = false
  } = params;

  const targetId = responsavel_id || atribuido_a_id;
  const targetName = responsavel_nome || atribuido_a_nome || 'Utilizador';
  const taskTitle = titulo || titulo_atividade || 'Nova Tarefa';
  const creator = criado_por_nome || criador_nome;
  const deadline = data_prazo || data_entrega;
  const finalAtividadeId = atividade_id || actividade_id || '';

  const actionText = isUpdate ? 'Atualizada' : 'Atribuída';
  const title = `📌 Actividade ${actionText}: ${taskTitle}`;
  const detailsMsg = detalhes 
    ? `${detalhes}${deadline ? ` (Prazo: ${deadline})` : ''}${creator ? ` — Por ${creator}` : ''}`
    : `Você recebeu uma tarefa: "${taskTitle}"${deadline ? ` com prazo até ${deadline}` : ''}${creator ? ` criada por ${creator}` : ''}.`;

  const promises: Promise<any>[] = [];

  // 1. Notify specific assigned user
  if (targetId && targetId !== 'todos') {
    promises.push(
      sendAppNotification({
        tenant_id,
        destinatario_id: targetId,
        destinatario_role: atribuido_a_role || (categoria_atribuicao === 'Docentes' ? 'docente' : categoria_atribuicao === 'Estudantes' ? 'estudante' : 'todos'),
        atividade_id: finalAtividadeId,
        turma_id,
        turma_nome,
        titulo: title,
        mensagem: detailsMsg,
        tipo: severidade === 'Crítica' || severidade === 'Alta' ? 'alerta' : 'info',
        modulo: 'atividades'
      })
    );
  }

  // 2. If assigned to a category/role or Todos, broadcast to that role
  if (categoria_atribuicao && categoria_atribuicao !== 'Individual') {
    const roleMap: Record<string, string> = {
      'Docentes': 'docente',
      'Estudantes': 'estudante',
      'Administrativos': 'admin',
      'Diretoria': 'director',
      'Todos': 'todos'
    };
    const mappedRole = roleMap[categoria_atribuicao] || 'todos';

    promises.push(
      sendAppNotification({
        tenant_id,
        destinatario_id: mappedRole === 'todos' ? 'todos' : mappedRole,
        destinatario_role: mappedRole,
        atividade_id: finalAtividadeId,
        turma_id,
        turma_nome,
        titulo: title,
        mensagem: `${detailsMsg} (Destinado a: ${categoria_atribuicao})`,
        tipo: severidade === 'Crítica' ? 'alerta' : 'info',
        modulo: 'atividades'
      })
    );
  }

  await Promise.allSettled(promises);
}
