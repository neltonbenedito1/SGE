import QRCode from 'qrcode';

export interface StudentQrData {
  type: 'SGE_STUDENT_BADGE';
  tenant_id: string;
  escola_id: string;
  student_id: string;
  matricula: string;
  user_id?: string;
  hash: string;
}

export const generateStudentQrPayload = (
  tenantId: string,
  escolaId: string,
  studentId: string,
  matricula: string,
  userId?: string
): string => {
  const payload: StudentQrData = {
    type: 'SGE_STUDENT_BADGE',
    tenant_id: tenantId,
    escola_id: escolaId,
    student_id: studentId,
    matricula: matricula || studentId,
    user_id: userId || '',
    hash: `BADGE-${tenantId.slice(0, 4)}-${studentId.slice(0, 6)}`.toUpperCase()
  };
  return JSON.stringify(payload);
};

export const generateQrDataUrl = async (text: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(text, {
      margin: 1,
      width: 200,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error("Error generating QR code data URL:", err);
    return '';
  }
};
