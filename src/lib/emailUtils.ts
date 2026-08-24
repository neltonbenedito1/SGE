/**
 * Email Utilities for UTF-8 Compatibility and English Email Generation
 * Fully supports international characters, accents, emojis, and special symbols
 * with standard RFC 2047 MIME encoding and base64url serialization.
 */

/**
 * Converts any UTF-8 string (including multi-byte emojis and special characters)
 * to a standard Base64 string without character range errors.
 */
export function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Encodes email headers (Subject, From Name) using RFC 2047 Q/B-encoding (UTF-8 Base64)
 * if they contain non-ASCII characters or emojis.
 */
export function encodeRfc2047Header(text: string): string {
  if (!text) return '';
  // Check if string contains characters outside standard printable ASCII range
  const isAsciiOnly = /^[\x20-\x7E]+$/.test(text);
  if (isAsciiOnly && !text.includes('=?') && !text.includes('\r') && !text.includes('\n')) {
    return text;
  }
  return `=?UTF-8?B?${utf8ToBase64(text)}?=`;
}

/**
 * Formats a full MIME message string with strict UTF-8 charset declarations
 */
export function createMimeMessage(options: {
  fromEmail: string;
  fromName?: string;
  to: string;
  subject: string;
  body: string;
}): string {
  const { fromEmail, fromName, to, subject, body } = options;
  const encodedFrom = fromName
    ? `${encodeRfc2047Header(fromName)} <${fromEmail}>`
    : fromEmail;
  const encodedSubject = encodeRfc2047Header(subject);

  const parts = [
    `From: ${encodedFrom}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    utf8ToBase64(body)
  ];

  return parts.join('\r\n');
}

/**
 * Encodes the MIME message into Base64URL format required by the Google Gmail REST API.
 */
export function createGmailRawPayload(options: {
  fromEmail: string;
  fromName?: string;
  to: string;
  subject: string;
  body: string;
}): string {
  const mime = createMimeMessage(options);
  const base64 = utf8ToBase64(mime);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Standard English Email Templates
 */
export const EmailTemplates = {
  // SuperAdmin: New Tenant Welcome and Credentials
  tenantWelcome: (params: {
    tenantName: string;
    slug: string;
    adminEmail: string;
    tempPassword: string;
  }) => ({
    subject: `🎉 Welcome to Educational SaaS - Your account is ready!`,
    body: `Hello,\n\nYour institution "${params.tenantName}" has been successfully registered on Educational SaaS!\n\nHere are your administrator access credentials:\n- Access Portal (Slug): ${params.slug}\n- Administrator Email: ${params.adminEmail}\n- Temporary Password: ${params.tempPassword}\n\nPlease change your temporary password upon your first login to ensure account security.\n\nBest regards,\nEducational SaaS Team`
  }),

  // SuperAdmin: SMTP Test Email
  smtpTest: (params: {
    providerName?: string;
  }) => ({
    subject: `📧 Test Email - Global SMTP Server`,
    body: `Hello!\n\nThis is a test email sent successfully through the integrated ${params.providerName || 'Gmail API / SMTP Server'} in your Educational SaaS.\n\nYour corporate email configuration is active and fully functional with full UTF-8 special character support (e.g., emojis 🎉, accents, and symbols)!\n\nBest regards,\nEducational SaaS Team`
  }),

  // SuperAdmin: 2FA Security Code for Encrypted Logs Decryption
  logsDecryption2FA: (params: {
    institutionName: string;
    code: string;
    expiresInMinutes?: number;
  }) => ({
    subject: `🔒 Security Verification Code (2FA) - Encrypted Logs Decryption`,
    body: `Hello Administrator of ${params.institutionName},\n\nA request to decrypt and download the encrypted security logs for your institution has been initiated on the Super Admin platform.\n\nYour 2-Factor Authentication (2FA) Security Code is:\n\n👉  ${params.code}  👈\n\nThis code will expire in ${params.expiresInMinutes || 15} minutes.\nIf you did not initiate this request, please review and update your security credentials immediately.\n\nBest regards,\nSecurity Operations - Educational SaaS`
  }),

  // SuperAdmin: 2FA Password Reset OTP
  passwordReset2FA: (params: {
    institutionName: string;
    code: string;
    expirationTimeStr?: string;
  }) => ({
    subject: `🔑 Password Reset Verification Code (2FA OTP) - ${params.institutionName}`,
    body: `Hello,\n\nWe received a request to reset the administrator password for the institution ${params.institutionName}.\n\nYour 6-digit OTP security code is:\n\n👉  ${params.code}  👈\n\n${params.expirationTimeStr ? `This code expires at ${params.expirationTimeStr}.\n` : 'This code expires in 15 minutes.\n'}If you did not make this request, please disregard this email.\n\nBest regards,\nEducational SaaS Security Team`
  }),

  // Tenant: Teacher Missing Documents / Profile Notice
  teacherMissingData: (params: {
    teacherName: string;
    missingDetails: string;
  }) => ({
    subject: `Notice: Academic Profile Update and Pending Documents`,
    body: `Dear Teacher ${params.teacherName},\n\nWe have noticed that there are pending details or documents in your institutional profile (${params.missingDetails || 'Qualifications or Documentation'}).\n\nPlease contact the Academic Directorate / Secretary Office to complete and regularize your dossier.\n\nBest regards,\nSchool Administration`
  }),

  // Tenant: Student Reactivation
  studentReactivation: (params: {
    studentName: string;
  }) => ({
    subject: `📢 Student Enrollment Reactivated - School Portal`,
    body: `Dear Guardian / Student,\n\nWe inform you that the enrollment for student "${params.studentName}" has been successfully reactivated in our School Management System.\n\nBest regards,\nSchool Administration`
  }),

  // Tenant: Director Appointment
  directorAppointment: (params: {
    directorName: string;
    schoolName: string;
  }) => ({
    subject: `🎓 Appointment Notification - School Director`,
    body: `Dear ${params.directorName},\n\nWe are pleased to inform you that you have been officially appointed as Director of "${params.schoolName}".\n\nIn accordance with your new assignment, your access profile and privileges on the School Management System portal have been updated to "School Directors & Managers".\n\nPlease log into the portal to access your new institutional management tools.\n\nBest regards,\nSchool Administration`
  }),

  // Tenant: Tuition / Invoice Reminder
  tuitionReminder: (params: {
    studentName: string;
    description: string;
    dueDate: string;
    amountFormatted: string;
  }) => ({
    subject: `⏳ Tuition Payment Reminder - School Management System`,
    body: `Dear Guardian / Student,\n\nThis is a reminder that the tuition fee "${params.description}" for student ${params.studentName}, due on ${params.dueDate} in the amount of ${params.amountFormatted}, is awaiting payment.\n\nPlease proceed with the payment to regularize the financial account.\n\nBest regards,\nFinance Department`
  }),

  // Tenant: Payment Receipt Confirmation
  paymentReceipt: (params: {
    studentName: string;
    description: string;
    amountFormatted: string;
  }) => ({
    subject: `🧾 Payment Receipt Confirmation - School Management System`,
    body: `Dear Guardian,\n\nWe successfully confirm the receipt of payment for invoice "${params.description}" in the amount of ${params.amountFormatted} for student ${params.studentName}.\n\nThank you for your prompt cooperation.\n\nBest regards,\nAcademic Secretary`
  }),

  // Tenant: Student Deactivation
  studentDeactivation: (params: {
    studentName: string;
    reason: string;
  }) => ({
    subject: `⚠️ Student Enrollment Status Update - School Portal`,
    body: `Dear Guardian,\n\nWe inform you that the enrollment for student "${params.studentName}" has been temporarily deactivated in the School Portal.\nReason: ${params.reason}\n\nFor any questions or clarification, please contact the school administration.\n\nBest regards,\nSchool Administration`
  }),

  // Tenant: Student Dropout - to Admin
  studentDropoutAdmin: (params: {
    studentName: string;
    enrollmentNo: string;
    reason?: string;
  }) => ({
    subject: `⚠️ Alert: Student Dropout Registered - ${params.studentName}`,
    body: `Dear Administrator,\n\nPlease be informed that student "${params.studentName}" (Enrollment No: ${params.enrollmentNo}) has officially discontinued studies${params.reason ? ` (Reason: ${params.reason})` : ''}. The student's portal access has been automatically suspended.\n\nBest regards,\nSchool Management System`
  }),

  // Tenant: Student Dropout - to Teachers
  studentDropoutTeacher: (params: {
    studentName: string;
    className: string;
  }) => ({
    subject: `📢 Academic Notice: Student Dropout - ${params.studentName}`,
    body: `Dear Teacher,\n\nPlease be informed that student "${params.studentName}" from class "${params.className}", which you instruct, has discontinued studies. Please disregard this student in upcoming evaluations and grade sheets.\n\nBest regards,\nSchool Management System`
  }),

  // Tenant: Student Dropout - to Parents
  studentDropoutParent: (params: {
    studentName: string;
  }) => ({
    subject: `⚠️ Official Notice: Studies Discontinuation - ${params.studentName}`,
    body: `Dear Guardian,\n\nWe confirm the registration in the School Management System that student "${params.studentName}" has discontinued studies at this institution. In accordance with internal procedures, student access to the school portal has been suspended.\n\nIf this information is incorrect or if you wish to appeal or reverse this process, please contact the school administration office immediately.\n\nBest regards,\nAcademic Directorate`
  }),

  // Tenant: Transfer Out - to Old Class Director
  transferOutDT: (params: {
    studentName: string;
    className: string;
    destinationSchoolName: string;
  }) => ({
    subject: `🔄 Student Transfer Departure - School Portal`,
    body: `Dear Teacher,\n\nWe inform you that student "${params.studentName}" has been transferred from your class (${params.className || 'N/A'}) to the institution "${params.destinationSchoolName}".\n\nBest regards,\nSchool Management System`
  }),

  // Tenant: Transfer In - to New Class Director
  transferInDT: (params: {
    studentName: string;
    className: string;
    originalSchoolName: string;
  }) => ({
    subject: `🔄 New Student Admitted (Transfer) - School Portal`,
    body: `Dear Teacher,\n\nWe inform you that student "${params.studentName}" has been admitted to your class (${params.className || 'N/A'}) via internal transfer from "${params.originalSchoolName}".\n\nBest regards,\nSchool Management System`
  }),

  // Tenant: Transfer Guide - to Guardian
  transferGuardian: (params: {
    studentName: string;
    destinationSchoolName: string;
  }) => ({
    subject: `🔄 Academic Transfer Confirmation - School Portal`,
    body: `Dear Guardian,\n\nWe confirm the internal transfer of student "${params.studentName}" to the institution "${params.destinationSchoolName}".\nAll academic records and grades have been synchronized automatically.\n\nBest regards,\nSchool Secretary`
  }),

  // Tenant: New Invoice Issued
  newInvoiceIssued: (params: {
    description: string;
    amountFormatted: string;
    dueDate: string;
  }) => ({
    subject: `🧾 New Invoice Issued - School Portal`,
    body: `Dear Guardian,\n\nWe inform you that a new invoice for "${params.description}" in the amount of ${params.amountFormatted} has been issued, with due date on ${params.dueDate}.\n\nPayment can be made directly at the school secretary office or via the portal.\n\nBest regards,\nFinance Department`
  }),

  // Tenant / General: User Credentials
  userCredentials: (params: {
    name: string;
    email: string;
    tempPassword: string;
    roleName?: string;
  }) => ({
    subject: `🎉 Welcome to School Portal - Your Login Credentials`,
    body: `Hello ${params.name},\n\nYour account on the School Portal has been created successfully${params.roleName ? ` as ${params.roleName}` : ''}!\n\nYour login credentials:\n- Email: ${params.email}\n- Temporary Password: ${params.tempPassword}\n\nPlease log in and update your temporary password to secure your account.\n\nBest regards,\nSchool Administration Team`
  })
};
