import React, { useEffect, useState } from 'react';
import { generateStudentQrPayload, generateQrDataUrl } from '../utils/qrCodeHelper';

interface StudentQrDisplayProps {
  tenantId: string;
  escolaId: string;
  studentId: string;
  matricula: string;
  userId?: string;
}

export const StudentQrDisplay: React.FC<StudentQrDisplayProps> = ({
  tenantId,
  escolaId,
  studentId,
  matricula,
  userId
}) => {
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    const generate = async () => {
      const payload = generateStudentQrPayload(tenantId, escolaId, studentId, matricula, userId);
      const dataUrl = await generateQrDataUrl(payload);
      if (isMounted) {
        setQrUrl(dataUrl);
      }
    };
    generate();
    return () => {
      isMounted = false;
    };
  }, [tenantId, escolaId, studentId, matricula, userId]);

  if (!qrUrl) {
    return (
      <div className="w-24 h-24 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] text-slate-400 font-mono animate-pulse">
        Gerando QR...
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-xs">
        <img src={qrUrl} alt="Crachá QR Code" className="w-24 h-24 object-contain" />
      </div>
    </div>
  );
};
