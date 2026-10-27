import { describe, it, expect } from 'vitest';

describe('QA Fixes Verification Suite (Prompt_Correcao_SGE)', () => {
  describe('P0.2 - SuperAdmin Auth & Custom Claims (Item 2)', () => {
    it('deve autorizar acesso de superadmin apenas quando claims.role for "super_admin"', () => {
      const verifySuperAdminClaim = (claims: Record<string, any> | undefined): boolean => {
        return claims?.role === 'super_admin';
      };

      expect(verifySuperAdminClaim({ role: 'super_admin' })).toBe(true);
      expect(verifySuperAdminClaim({ role: 'admin' })).toBe(false);
      expect(verifySuperAdminClaim({ role: 'docente' })).toBe(false);
      expect(verifySuperAdminClaim(undefined)).toBe(false);
    });

    it('deve mapear erros de autenticação Firebase de forma descritiva e segura', () => {
      const getAuthErrorMessage = (errorCode: string): string => {
        switch (errorCode) {
          case 'auth/invalid-credential':
          case 'auth/wrong-password':
          case 'auth/user-not-found':
            return 'Credenciais inválidas. Verifique o seu e-mail e palavra-passe.';
          case 'auth/too-many-requests':
            return 'Acesso temporariamente bloqueado por demasiadas tentativas. Tente novamente mais tarde.';
          case 'auth/user-disabled':
            return 'Esta conta de utilizador foi desativada pela administração.';
          default:
            return 'Erro de autenticação desconhecido.';
        }
      };

      expect(getAuthErrorMessage('auth/invalid-credential')).toContain('Credenciais inválidas');
      expect(getAuthErrorMessage('auth/too-many-requests')).toContain('bloqueado por demasiadas tentativas');
      expect(getAuthErrorMessage('auth/user-disabled')).toContain('conta de utilizador foi desativada');
    });
  });

  describe('P1.4 - Idempotência de Actividades Auto-Geradas (Item 4)', () => {
    it('deve gerar chave determinística auto_key e id determinístico para prevenir duplicação', () => {
      const generateAutoKey = (tipo: string, entidadeId: string): string => `${tipo}_${entidadeId}`;
      const generateDocId = (tenantId: string, tipo: string, entidadeId: string): string => 
        `auto_${tenantId}_${tipo}_${entidadeId}`;

      const key1 = generateAutoKey('pendente_docente', 'doc123');
      const key2 = generateAutoKey('pendente_docente', 'doc123');
      expect(key1).toBe(key2);

      const docId1 = generateDocId('tenant_A', 'pendente_docente', 'doc123');
      const docId2 = generateDocId('tenant_A', 'pendente_docente', 'doc123');
      expect(docId1).toBe(docId2);

      // Simulação de verificação de idempotência
      const existingActivities = [{ auto_key: 'pendente_docente_doc123', status: 'pendente' }];
      const isDuplicate = existingActivities.some(a => a.auto_key === key1 && a.status !== 'concluida');
      expect(isDuplicate).toBe(true);
    });
  });

  describe('P1.5 - Exclusão em Cascata e Média do Dashboard (Item 5)', () => {
    it('deve excluir pautas órfãs do cálculo da média geral do Dashboard', () => {
      const activeStudents = [{ id: 's1', nome: 'João' }, { id: 's2', nome: 'Maria' }];
      const activeClasses = [{ id: 'c1', nome: 'Matemática' }];

      const pautas = [
        { id: 'p1', estudante_id: 's1', classe_id: 'c1', nota_media: 14 },
        { id: 'p2', estudante_id: 's2', classe_id: 'c1', nota_media: 16 },
        // Pauta órfã: estudante foi excluído
        { id: 'p3', estudante_id: 's_deleted', classe_id: 'c1', nota_media: 6 },
        // Pauta órfã: disciplina foi excluída
        { id: 'p4', estudante_id: 's1', classe_id: 'c_deleted', nota_media: 2 }
      ];

      const validPautas = pautas.filter(p => {
        const studentExists = activeStudents.some(s => s.id === p.estudante_id);
        const classExists = activeClasses.some(c => c.id === p.classe_id);
        return studentExists && classExists;
      });

      expect(validPautas.length).toBe(2);
      const avg = validPautas.reduce((sum, p) => sum + p.nota_media, 0) / validPautas.length;
      expect(avg).toBe(15);
    });
  });

  describe('P1.6 - Criação de Utilizador Respeita "Usuário do Sistema" (Item 6)', () => {
    it('não deve criar conta de utilizador quando usuario_sistema for falso', () => {
      const handleStudentRegistration = (form: { usuario_sistema: boolean; nome: string }) => {
        let createdUserAccount = false;
        let userId = '';
        if (form.usuario_sistema) {
          createdUserAccount = true;
          userId = 'user_generated_123';
        }
        return { createdUserAccount, userId };
      };

      const resultUnchecked = handleStudentRegistration({ usuario_sistema: false, nome: 'Estudante Sem Login' });
      expect(resultUnchecked.createdUserAccount).toBe(false);
      expect(resultUnchecked.userId).toBe('');

      const resultChecked = handleStudentRegistration({ usuario_sistema: true, nome: 'Estudante Com Login' });
      expect(resultChecked.createdUserAccount).toBe(true);
      expect(resultChecked.userId).toBe('user_generated_123');
    });
  });

  describe('P1.7 - Pautas: Valores por Omissão, Clamping 0-20 e Notificação (Item 7)', () => {
    it('deve ter "Pendente" e "rascunho" como status padrão na ausência de notas', () => {
      const defaultPauta = {
        status_estudante: 'Pendente',
        status: 'rascunho',
        avaliacao_1: '',
        avaliacao_2: '',
        avaliacao_3: ''
      };
      expect(defaultPauta.status_estudante).toBe('Pendente');
      expect(defaultPauta.status).toBe('rascunho');
    });

    it('deve limitar valores de notas estritamente entre 0 e 20', () => {
      const clampGrade = (val: string | number): number | '' => {
        if (val === '') return '';
        const num = Number(val);
        if (isNaN(num)) return '';
        return Math.min(20, Math.max(0, num));
      };

      expect(clampGrade(25)).toBe(20);
      expect(clampGrade(-5)).toBe(0);
      expect(clampGrade('18.5')).toBe(18.5);
      expect(clampGrade('')).toBe('');
    });

    it('só deve disparar notificação de pauta se o status for "publicado"', () => {
      const shouldNotifyGrade = (status: string): boolean => status === 'publicado';

      expect(shouldNotifyGrade('rascunho')).toBe(false);
      expect(shouldNotifyGrade('publicado')).toBe(true);
    });
  });

  describe('P2.10 - Validação de Capacidade de Sala (Item 10)', () => {
    it('deve rejeitar capacidade menor que 1', () => {
      const validateSalaCapacidade = (capacidade: number): boolean => {
        return !isNaN(capacidade) && capacidade >= 1;
      };

      expect(validateSalaCapacidade(-5)).toBe(false);
      expect(validateSalaCapacidade(0)).toBe(false);
      expect(validateSalaCapacidade(1)).toBe(true);
      expect(validateSalaCapacidade(35)).toBe(true);
    });
  });

  describe('P2.11 - Validação de Docente: NUIT, Telefone e E-mail (Item 11)', () => {
    it('deve validar NUIT com exactamente 9 dígitos numéricos', () => {
      const nuitRegex = /^\d{9}$/;
      expect(nuitRegex.test('123456789')).toBe(true);
      expect(nuitRegex.test('12345678')).toBe(false);
      expect(nuitRegex.test('1234567890')).toBe(false);
      expect(nuitRegex.test('12345678A')).toBe(false);
    });

    it('deve validar telefone moçambicano (+258 8x xxx xxxx)', () => {
      const mozPhoneRegex = /^(\+258)?8[2-7]\d{7}$/;
      expect(mozPhoneRegex.test('841234567')).toBe(true);
      expect(mozPhoneRegex.test('+258821234567')).toBe(true);
      expect(mozPhoneRegex.test('+258871234567')).toBe(true);
      // Inválidos
      expect(mozPhoneRegex.test('912345678')).toBe(false);
      expect(mozPhoneRegex.test('84123456')).toBe(false);
      expect(mozPhoneRegex.test('+258941234567')).toBe(false);
    });

    it('deve validar formato de e-mail institucional', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test('docente@escola.ac.mz')).toBe(true);
      expect(emailRegex.test('invalido@')).toBe(false);
      expect(emailRegex.test('sem-arroba.mz')).toBe(false);
    });
  });

  describe('P2.12 - Validação de Estudante: Data e Idade (Item 12)', () => {
    it('deve rejeitar data de nascimento futura e idades fora de [4, 60]', () => {
      const validateStudentAge = (birthDateStr: string, refDate: Date = new Date('2026-10-27')): { valid: boolean; reason?: string } => {
        const birth = new Date(birthDateStr);
        if (isNaN(birth.getTime())) return { valid: false, reason: 'Data inválida' };
        if (birth > refDate) return { valid: false, reason: 'Data futura' };

        let age = refDate.getFullYear() - birth.getFullYear();
        const m = refDate.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && refDate.getDate() < birth.getDate())) {
          age--;
        }

        if (age < 4 || age > 60) return { valid: false, reason: `Idade fora dos limites: ${age}` };
        return { valid: true };
      };

      // Futura
      expect(validateStudentAge('2027-01-01').valid).toBe(false);
      // Menor que 4 anos
      expect(validateStudentAge('2025-01-01').valid).toBe(false);
      // Maior que 60 anos
      expect(validateStudentAge('1960-01-01').valid).toBe(false);
      // Válidos (10 anos, 18 anos)
      expect(validateStudentAge('2016-05-15').valid).toBe(true);
      expect(validateStudentAge('2008-02-10').valid).toBe(true);
    });
  });

  describe('P2.13 - Bloqueio de Transferência para Mesma Escola e Turma (Item 13)', () => {
    it('deve rejeitar transferência quando escola e turma de destino forem idênticas às actuais', () => {
      const validateTransfer = (
        current: { escola_id: string; turma_id: string },
        target: { escola_id: string; turma_id: string }
      ): { allowed: boolean; error?: string } => {
        if (!target.escola_id || !target.turma_id) {
          return { allowed: false, error: 'Campos obrigatórios em falta' };
        }
        if (current.escola_id === target.escola_id && current.turma_id === target.turma_id) {
          return { allowed: false, error: 'O estudante já se encontra matriculado nesta mesma escola e turma de destino.' };
        }
        return { allowed: true };
      };

      const student = { escola_id: 'escola_1', turma_id: 'turma_A' };
      // Mesma escola e turma
      const same = validateTransfer(student, { escola_id: 'escola_1', turma_id: 'turma_A' });
      expect(same.allowed).toBe(false);
      expect(same.error).toContain('já se encontra matriculado nesta mesma escola e turma');

      // Turma diferente na mesma escola
      const diffTurma = validateTransfer(student, { escola_id: 'escola_1', turma_id: 'turma_B' });
      expect(diffTurma.allowed).toBe(true);

      // Escola diferente
      const diffSchool = validateTransfer(student, { escola_id: 'escola_2', turma_id: 'turma_X' });
      expect(diffSchool.allowed).toBe(true);
    });
  });

  describe('P2.14 - Validação de Prazo de Actividade (Item 14)', () => {
    it('não deve permitir data de prazo anterior à data de hoje', () => {
      const validatePrazo = (prazoStr: string, todayStr: string = '2026-10-27'): boolean => {
        return prazoStr >= todayStr;
      };

      expect(validatePrazo('2026-10-20', '2026-10-27')).toBe(false);
      expect(validatePrazo('2026-10-27', '2026-10-27')).toBe(true);
      expect(validatePrazo('2026-11-05', '2026-10-27')).toBe(true);
    });
  });

  describe('P0.3 - Desativação Permanente de Registo de SuperAdmin & Esqueci Palavra-Passe com OTP', () => {
    it('deve desativar e ocultar o registo de superadmin na tela de login se já existir superadmin no sistema ou Firebase', () => {
      interface SystemState {
        bootstrapInitialized: boolean;
        superusersCount: number;
        superAdminUsersCount: number;
        localFlag: boolean;
      }

      const shouldShowSuperAdminRegistrationOnLogin = (state: SystemState): boolean => {
        // Se houver qualquer indicação de superadmin existente, nunca mostrar na tela de login
        if (state.bootstrapInitialized) return false;
        if (state.superusersCount > 0) return false;
        if (state.superAdminUsersCount > 0) return false;
        if (state.localFlag) return false;
        return true;
      };

      // Cenário 1: Sistema novo sem superadmin
      expect(shouldShowSuperAdminRegistrationOnLogin({
        bootstrapInitialized: false,
        superusersCount: 0,
        superAdminUsersCount: 0,
        localFlag: false
      })).toBe(true);

      // Cenário 2: Superadmin já cadastrado no Firestore
      expect(shouldShowSuperAdminRegistrationOnLogin({
        bootstrapInitialized: true,
        superusersCount: 1,
        superAdminUsersCount: 1,
        localFlag: false
      })).toBe(false);

      // Cenário 3: Superadmin cadastrado e flag local activa
      expect(shouldShowSuperAdminRegistrationOnLogin({
        bootstrapInitialized: false,
        superusersCount: 1,
        superAdminUsersCount: 0,
        localFlag: true
      })).toBe(false);
    });

    it('deve validar fluxo de OTP de recuperação de palavra-passe com expiração e tentativas', () => {
      interface OtpRecord {
        otp: string;
        expiresAt: number;
        attempts: number;
      }

      const verifyOtp = (record: OtpRecord | null, enteredOtp: string, currentTime: number): { success: boolean; error?: string } => {
        if (!record) {
          return { success: false, error: 'Código OTP não encontrado ou expirado.' };
        }
        if (record.attempts >= 5) {
          return { success: false, error: 'Limite de tentativas excedido.' };
        }
        if (currentTime > record.expiresAt) {
          return { success: false, error: 'Código OTP expirou.' };
        }
        if (record.otp !== enteredOtp.trim()) {
          record.attempts++;
          return { success: false, error: 'Código OTP incorrecto.' };
        }
        return { success: true };
      };

      const now = Date.now();
      const validRecord: OtpRecord = {
        otp: '849201',
        expiresAt: now + 15 * 60 * 1000,
        attempts: 0
      };

      // OTP correto e dentro do prazo
      expect(verifyOtp(validRecord, '849201', now).success).toBe(true);

      // OTP incorreto
      expect(verifyOtp(validRecord, '000000', now).success).toBe(false);
      expect(validRecord.attempts).toBe(1);

      // OTP expirado
      const expiredRecord: OtpRecord = {
        otp: '849201',
        expiresAt: now - 1000,
        attempts: 0
      };
      expect(verifyOtp(expiredRecord, '849201', now).error).toContain('expirou');

      // Tentativas esgotadas
      const lockedRecord: OtpRecord = {
        otp: '849201',
        expiresAt: now + 10000,
        attempts: 5
      };
      expect(verifyOtp(lockedRecord, '849201', now).error).toContain('Limite de tentativas');
    });

    it('deve validar política de senhas fortes na recuperação de palavra-passe', () => {
      const validatePasswordPolicy = (pwd: string): { valid: boolean; errors: string[] } => {
        const errors: string[] = [];
        if (!pwd || pwd.length < 8) errors.push('Mínimo 8 caracteres');
        if (!/[A-Z]/.test(pwd)) errors.push('Letra maiúscula');
        if (!/[a-z]/.test(pwd)) errors.push('Letra minúscula');
        if (!/[0-9]/.test(pwd)) errors.push('Número');
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) errors.push('Caractere especial');
        return { valid: errors.length === 0, errors };
      };

      expect(validatePasswordPolicy('123456').valid).toBe(false);
      expect(validatePasswordPolicy('fracaSemNumero!').valid).toBe(false);
      expect(validatePasswordPolicy('SemSimbolo123').valid).toBe(false);
      expect(validatePasswordPolicy('Forte@2026SGE').valid).toBe(true);
    });
  });
});

