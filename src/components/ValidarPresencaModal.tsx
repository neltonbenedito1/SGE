import React, { useState, useEffect, useRef } from 'react';
import { 
  QrCode, 
  IdCard, 
  X, 
  Camera, 
  RefreshCw, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  User, 
  Calendar, 
  Building, 
  GraduationCap, 
  Check, 
  XCircle,
  BookOpen
} from 'lucide-react';
import jsQR from 'jsqr';

interface ValidarPresencaModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTenantId: string;
  activeEscolaId: string;
  students: any[];
  teachers: any[];
  users: any[];
  classes?: any[];
  turmas?: any[];
  schools?: any[];
  onValidatePerson: (person: any, tipo: 'estudante' | 'docente', mode: 'qr_code' | 'codigo_manual') => Promise<void>;
}

interface ScannedBadgeData {
  person: any;
  tipo: 'estudante' | 'docente';
  user?: any;
  hasAgenda: boolean;
  agendaClasses: any[];
  escolaNome: string;
  turmaOuEspecialidade: string;
  validated: boolean;
  msg: string;
}

export const ValidarPresencaModal: React.FC<ValidarPresencaModalProps> = ({
  isOpen,
  onClose,
  currentTenantId,
  activeEscolaId,
  students,
  teachers,
  users,
  classes = [],
  turmas = [],
  schools = [],
  onValidatePerson
}) => {
  const [activeTab, setActiveTab] = useState<'qr' | 'manual'>('qr');
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanResultMsg, setScanResultMsg] = useState<{ type: 'sucesso' | 'erro'; msg: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannedBadge, setScannedBadge] = useState<ScannedBadgeData | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const getTodayDayName = (): string => {
    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const today = new Date().getDay();
    return days[today];
  };

  useEffect(() => {
    if (isOpen && activeTab === 'qr' && !scannedBadge) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, scannedBadge]);

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setScanning(false);
  };

  const startCamera = async () => {
    stopCamera();
    setCameraError(null);
    setScanResultMsg(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Navegador não suporta acesso direto à câmera. Utilize o upload de foto do crachá ou digite o código.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.play();
        setScanning(true);
        requestAnimationFrame(tickScan);
      }
    } catch (err: any) {
      console.warn("Erro ao iniciar câmera:", err);
      setCameraError("Não foi possível acessar a câmera do dispositivo. Verifique as permissões do navegador ou digite o código do crachá.");
    }
  };

  const tickScan = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current;
      if (canvas) {
        const video = videoRef.current;
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert"
          });

          if (code && code.data) {
            handleDecodedQr(code.data);
            return;
          }
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(tickScan);
  };

  // Helper to check agenda for today
  const evaluatePersonAgenda = (person: any, tipo: 'estudante' | 'docente') => {
    const todayName = getTodayDayName().toLowerCase();
    const todayShort = todayName.split('-')[0].trim();

    if (tipo === 'estudante') {
      const turmaId = person?.turma_id || '';
      if (!turmaId) return { hasAgenda: true, agendaClasses: [] };

      const matchedClasses = classes.filter(c => {
        if (c.turma_id !== turmaId) return false;
        const classDay = (c.dia_semana || c.data || '').toLowerCase();
        if (!classDay) return true;
        return classDay.includes(todayShort) || todayShort.includes(classDay) || classDay.includes(todayName);
      });

      const turmaClasses = classes.filter(c => c.turma_id === turmaId);
      return {
        hasAgenda: true,
        agendaClasses: matchedClasses.length > 0 ? matchedClasses : turmaClasses
      };
    } else {
      // docente / funcionario
      const teacherId = person?.id || '';
      const matchedClasses = classes.filter(c => {
        if (c.docente_id !== teacherId) return false;
        const classDay = (c.dia_semana || c.data || '').toLowerCase();
        if (!classDay) return true;
        return classDay.includes(todayShort) || todayShort.includes(classDay) || classDay.includes(todayName);
      });

      return {
        hasAgenda: true,
        agendaClasses: matchedClasses
      };
    }
  };

  const processPersonMatch = async (matchedPerson: any, tipo: 'estudante' | 'docente', mode: 'qr_code' | 'codigo_manual') => {
    const matchedUser = users.find(u => u.id === matchedPerson.user_id);
    const personSchool = schools.find(s => s.id === matchedPerson.escola_id);
    const personTurma = tipo === 'estudante' ? turmas.find(t => t.id === matchedPerson.turma_id) : null;

    const escolaNome = personSchool?.nome || 'Escola da Rede';
    const turmaOuEspecialidade = tipo === 'estudante' 
      ? (personTurma?.nome || 'Sem Turma Defina') 
      : (matchedPerson.especialidade || 'Docente / Funcionário');

    const { hasAgenda, agendaClasses } = evaluatePersonAgenda(matchedPerson, tipo);

    if (hasAgenda) {
      await onValidatePerson(matchedPerson, tipo, mode);
      setScannedBadge({
        person: matchedPerson,
        tipo,
        user: matchedUser,
        hasAgenda: true,
        agendaClasses,
        escolaNome,
        turmaOuEspecialidade,
        validated: true,
        msg: `✅ Presença Validada com Sucesso! Agenda confirmada para ${getTodayDayName()}.`
      });
      setScanResultMsg({
        type: 'sucesso',
        msg: `✅ Presença confirmada para ${matchedPerson.nome || matchedUser?.nome || 'Pessoa'}`
      });
    } else {
      setScannedBadge({
        person: matchedPerson,
        tipo,
        user: matchedUser,
        hasAgenda: false,
        agendaClasses: [],
        escolaNome,
        turmaOuEspecialidade,
        validated: false,
        msg: `❌ Presença NÃO Validada! Não possui aula ou agenda cadastrada para hoje (${getTodayDayName()}).`
      });
      setScanResultMsg({
        type: 'erro',
        msg: `❌ Presença Recusada: O ${tipo === 'estudante' ? 'estudante' : 'funcionário'} não tem agenda agendada para hoje.`
      });
    }
  };

  const processQrCodeText = async (qrText: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setScanResultMsg(null);

    try {
      let parsed: any = null;
      try {
        parsed = JSON.parse(qrText);
      } catch (e) {
        parsed = { code: qrText.trim() };
      }

      if (parsed.tenant_id && parsed.tenant_id !== currentTenantId) {
        setScanResultMsg({
          type: 'erro',
          msg: '❌ ACESSO NEGADO: Este crachá pertence a outra instituição de ensino!'
        });
        setIsProcessing(false);
        return;
      }

      if (parsed.escola_id && activeEscolaId && parsed.escola_id !== activeEscolaId) {
        setScanResultMsg({
          type: 'erro',
          msg: '❌ ACESSO NEGADO: Este crachá pertence a outra escola/unidade!'
        });
        setIsProcessing(false);
        return;
      }

      const rawCode = (parsed.student_id || parsed.id || parsed.matricula || parsed.registro_id || parsed.user_id || parsed.code || '').toString().toLowerCase().trim();
      
      const matchedStudent = students.find(s => 
        (s.id && s.id.toLowerCase() === rawCode) || 
        (s.numero_matricula && s.numero_matricula.toLowerCase() === rawCode) ||
        (s.user_id && s.user_id.toLowerCase() === rawCode) ||
        (s.id && parsed.student_id && s.id === parsed.student_id) ||
        (s.numero_matricula && parsed.matricula && s.numero_matricula.toLowerCase() === (parsed.matricula || '').toLowerCase()) ||
        (s.qr_code_data && s.qr_code_data.includes(rawCode))
      );

      const matchedTeacher = teachers.find(t => 
        t.id.toLowerCase() === rawCode || 
        (t.numero_registro || '').toLowerCase() === rawCode
      );

      if (matchedStudent) {
        if (matchedStudent.ativo === false || matchedStudent.cracha_inutilizado === true) {
          setScanResultMsg({ type: 'erro', msg: `❌ CRACHÁ INUTILIZADO: O estudante ${matchedStudent.nome || ''} encontra-se suspenso ou inativo no sistema.` });
          setIsProcessing(false);
          return;
        }
        await processPersonMatch(matchedStudent, 'estudante', 'qr_code');
      } else if (matchedTeacher) {
        await processPersonMatch(matchedTeacher, 'docente', 'qr_code');
      } else {
        setScanResultMsg({
          type: 'erro',
          msg: `❌ Nenhum estudante ou docente/funcionário encontrado com o código: "${rawCode}"`
        });
      }
    } catch (err: any) {
      setScanResultMsg({ type: 'erro', msg: `Erro ao processar QR Code: ${err.message || err}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecodedQr = (dataStr: string) => {
    stopCamera();
    processQrCodeText(dataStr);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            processQrCodeText(code.data);
          } else {
            setScanResultMsg({ type: 'erro', msg: '❌ Não foi possível reconhecer um código QR na imagem enviada.' });
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim() || isProcessing) return;

    setIsProcessing(true);
    setScanResultMsg(null);

    const val = manualCode.trim().toLowerCase();
    const studentMatch = students.find(s => 
      s.id.toLowerCase() === val || 
      (s.numero_matricula || '').toLowerCase() === val
    );
    const teacherMatch = teachers.find(t => 
      t.id.toLowerCase() === val || 
      (t.numero_registro || '').toLowerCase() === val
    );

    if (studentMatch) {
      if (studentMatch.ativo === false || studentMatch.cracha_inutilizado === true) {
        setScanResultMsg({ type: 'erro', msg: '❌ CRACHÁ INUTILIZADO: O estudante encontra-se suspenso ou inativo no sistema.' });
        setIsProcessing(false);
        return;
      }
      await processPersonMatch(studentMatch, 'estudante', 'codigo_manual');
      setManualCode('');
    } else if (teacherMatch) {
      await processPersonMatch(teacherMatch, 'docente', 'codigo_manual');
      setManualCode('');
    } else {
      setScanResultMsg({ type: 'erro', msg: `❌ Código "${manualCode}" não encontrado para estudantes ou funcionários.` });
    }
    setIsProcessing(false);
  };

  const handleResetScan = () => {
    setScannedBadge(null);
    setScanResultMsg(null);
    if (activeTab === 'qr') {
      startCamera();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-[9995] animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={() => { stopCamera(); onClose(); }}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-600/20">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black font-sans dark:text-slate-100">Validar Presença do Aluno / Funcionário</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Exibição do crachá e verificação automática de agenda para {getTodayDayName()}.</p>
          </div>
        </div>

        {/* DISPLAY CRACHÁ CARD IF SCANNED */}
        {scannedBadge ? (
          <div className="space-y-4 animate-in zoom-in-95 duration-200">
            {/* CRACHÁ CARD DISPLAY */}
            <div className={`rounded-3xl border-2 overflow-hidden shadow-xl transition-all ${
              scannedBadge.validated 
                ? 'border-emerald-500/50 bg-gradient-to-b from-emerald-950/20 via-slate-900 to-slate-900' 
                : 'border-rose-500/50 bg-gradient-to-b from-rose-950/20 via-slate-900 to-slate-900'
            }`}>
              {/* HEADER RIBBON */}
              <div className={`px-4 py-2.5 text-center text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 ${
                scannedBadge.validated ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
              }`}>
                {scannedBadge.tipo === 'estudante' ? <GraduationCap className="w-4 h-4" /> : <Building className="w-4 h-4" />}
                <span>Crachá de {scannedBadge.tipo === 'estudante' ? 'Estudante' : 'Funcionário / Docente'}</span>
              </div>

              <div className="p-5 text-slate-100 space-y-4">
                {/* PHOTO & BASIC INFO */}
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-800 border-2 border-slate-700 shrink-0 flex items-center justify-center shadow-md">
                    {scannedBadge.person.foto_url || scannedBadge.person.avatar_url ? (
                      <img 
                        src={scannedBadge.person.foto_url || scannedBadge.person.avatar_url} 
                        alt={scannedBadge.person.nome} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full bg-indigo-900/50 flex flex-col items-center justify-center text-indigo-300 font-bold text-xl">
                        <User className="w-8 h-8 text-indigo-400 mb-0.5" />
                        <span className="text-[10px]">FOTO</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 flex-1 min-w-0">
                    <span className="inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700">
                      {scannedBadge.escolaNome}
                    </span>
                    <h4 className="text-base font-black truncate text-white leading-tight">
                      {scannedBadge.person.nome || scannedBadge.user?.nome || 'Sem Nome'}
                    </h4>
                    <p className="text-xs font-mono font-semibold text-emerald-400 flex items-center gap-1">
                      <IdCard className="w-3.5 h-3.5 shrink-0" />
                      {scannedBadge.tipo === 'estudante' 
                        ? `Matrícula: ${scannedBadge.person.numero_matricula || scannedBadge.person.id}`
                        : `Registro: ${scannedBadge.person.numero_registro || scannedBadge.person.id}`}
                    </p>
                    <p className="text-xs text-slate-400 font-medium">
                      {scannedBadge.turmaOuEspecialidade}
                    </p>
                  </div>
                </div>

                {/* AGENDA CHECK DETAILS */}
                <div className="bg-slate-950/80 rounded-2xl p-3.5 border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <span className="font-bold text-slate-300 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      Agenda de Hoje ({getTodayDayName()})
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      scannedBadge.hasAgenda ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {scannedBadge.hasAgenda ? 'AGENDA CONFIRMADA' : 'SEM AGENDA'}
                    </span>
                  </div>

                  {scannedBadge.hasAgenda ? (
                    <div className="space-y-1 pt-1">
                      <p className="text-[11px] text-slate-400 font-semibold">Aulas / Disciplinas de Hoje:</p>
                      {scannedBadge.agendaClasses.map((ac, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[11px] bg-slate-900/60 p-2 rounded-xl text-slate-200">
                          <span className="font-bold flex items-center gap-1.5">
                            <BookOpen className="w-3 h-3 text-indigo-400" />
                            {ac.nome || 'Disciplina'}
                          </span>
                          <span className="font-mono text-slate-400">{ac.horario || 'Em Horário Curricular'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-rose-300 italic pt-1 leading-relaxed">
                      Nenhuma disciplina ou aula foi agendada no horário curricular para este utilizador na data de hoje. Presença recusada.
                    </p>
                  )}
                </div>

                {/* VALIDATION STATUS BANNER */}
                <div className={`p-4 rounded-2xl border text-xs font-bold flex items-start gap-3 shadow-md ${
                  scannedBadge.validated
                    ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                    : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
                }`}>
                  {scannedBadge.validated ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="text-sm font-black tracking-tight">{scannedBadge.validated ? 'PRESENÇA VALIDADA' : 'VALIDAÇÃO RECUSADA'}</p>
                    <p className="text-xs font-normal opacity-90 leading-relaxed">{scannedBadge.msg}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ACTION BUTTON TO SCAN NEXT */}
            <button
              type="button"
              onClick={handleResetScan}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-2xl text-xs transition-all cursor-pointer shadow-lg shadow-indigo-600/20 text-center flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Escanear Outro Crachá / Código
            </button>
          </div>
        ) : (
          <>
            {/* TAB SWITCHER */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-5 border border-slate-200/60 dark:border-slate-700">
              <button
                type="button"
                onClick={() => { setActiveTab('qr'); setScanResultMsg(null); }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'qr'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Camera className="w-4 h-4" />
                Ler QR Code
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('manual'); stopCamera(); setScanResultMsg(null); }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'manual'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <IdCard className="w-4 h-4" />
                Introduzir Código
              </button>
            </div>

            {/* FEEDBACK DISPLAY */}
            {scanResultMsg && (
              <div className={`mb-4 p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2.5 ${
                scanResultMsg.type === 'sucesso'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
              }`}>
                {scanResultMsg.type === 'sucesso' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />}
                <span className="leading-snug">{scanResultMsg.msg}</span>
              </div>
            )}

            {/* TAB 1: LER QR CODE */}
            {activeTab === 'qr' && (
              <div className="space-y-4">
                <div className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden border-2 border-dashed border-indigo-500/40 flex flex-col items-center justify-center">
                  <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />

                  {!scanning && !cameraError && (
                    <div className="relative z-10 text-center p-4 space-y-2">
                      <Camera className="w-10 h-10 text-indigo-400 mx-auto animate-pulse" />
                      <p className="text-xs font-bold text-slate-300">Iniciando leitor de QR Code...</p>
                    </div>
                  )}

                  {scanning && (
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                      <div className="w-44 h-44 border-2 border-emerald-400 rounded-2xl relative shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-500 rounded-br-lg" />
                        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-emerald-400 shadow-[0_0_10px_#10b981] animate-ping" />
                      </div>
                      <span className="mt-3 bg-slate-900/80 backdrop-blur-xs text-emerald-400 font-mono text-[10px] px-3 py-1 rounded-full border border-emerald-500/30">
                        Aguardando enquadramento do crachá...
                      </span>
                    </div>
                  )}

                  {cameraError && (
                    <div className="relative z-10 text-center p-4 space-y-2 text-rose-300">
                      <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto" />
                      <p className="text-xs leading-relaxed">{cameraError}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Reiniciar Câmera
                  </button>

                  <label className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 text-center shadow-md shadow-indigo-600/20">
                    <Upload className="w-3.5 h-3.5" /> Upload Foto do Crachá
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>
            )}

            {/* TAB 2: INTRODUZIR CÓDIGO */}
            {activeTab === 'manual' && (
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Número de Matrícula / Nº de Registro / ID
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Ex: MAT-2026-001 ou DOC-102"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 text-sm font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!manualCode.trim() || isProcessing}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-2xl text-xs transition-all cursor-pointer shadow-lg shadow-indigo-600/20 text-center"
                >
                  {isProcessing ? 'Verificando Crachá & Agenda...' : 'Validar Presença do Código'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};
