/**
 * WhatsApp Direct Click-to-Chat & Template Engine
 * 100% Free, Official wa.me Deep Links - Zero API Keys, Zero Cost, Zero Ban Risk
 */

export function cleanIndianPhone(rawPhone?: string | null): string {
  if (!rawPhone) return "";
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return "";
  // If 10 digits (standard Indian mobile), prepend 91
  if (digits.length === 10) return `91${digits}`;
  // If 11 digits starting with 0, replace 0 with 91
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  // Already has country code (e.g. 919876543210)
  return digits;
}

export function createWhatsAppUrl(
  phoneOrParams?: string | null | { phone?: string | null; message?: string },
  text: string = ""
): string {
  if (typeof phoneOrParams === "object" && phoneOrParams !== null) {
    return createWhatsAppUrl(phoneOrParams.phone, phoneOrParams.message || "");
  }
  const cleanPhone = cleanIndianPhone(phoneOrParams);
  const encoded = encodeURIComponent(text);
  if (!cleanPhone) {
    // If no phone provided, opens WhatsApp with prefilled text so user can pick contact
    return `https://wa.me/?text=${encoded}`;
  }
  return `https://wa.me/${cleanPhone}?text=${encoded}`;
}

export interface AbsentAlertParams {
  institutionName?: string;
  schoolName?: string;
  studentName: string;
  className?: string;
  admissionNo: string;
  date: string;
  time?: string;
  portalUrl?: string;
  originUrl?: string;
  studentId?: string;
  schoolPhone?: string;
}

export function formatAbsentAlertMessage(params: AbsentAlertParams): string {
  const org = (params.schoolName || params.institutionName || "School Administration").toUpperCase();
  const { studentName, className, admissionNo, date, schoolPhone } = params;
  const pUrl = params.portalUrl || (params.originUrl ? `${params.originUrl}/students` : "");

  return `🏫 *${org}*
📅 *Date:* ${date}

Respected Parent,
This is to notify you that your ward *${studentName}* ${className ? `(Class: ${className})` : ""}${admissionNo ? ` [ID: ${admissionNo}]` : ""} has been marked ❌ *ABSENT* today.

If this is due to illness or an unavoidable emergency, please update the school administration.

${pUrl ? `🔗 *Live Student Portal & Attendance:* \n${pUrl}\n` : ""}${schoolPhone ? `📞 *School Helpline:* ${schoolPhone}\n` : ""}
_Regards,_
*Principal / Administration Office*`;
}

export interface FeeReminderParams {
  institutionName?: string;
  schoolName?: string;
  studentName: string;
  className?: string;
  admissionNo: string;
  dueAmount: number | string;
  dueMonthsCount?: number;
  portalUrl?: string;
  originUrl?: string;
  studentId?: string;
  schoolPhone?: string;
}

export function formatFeeReminderMessage(params: FeeReminderParams): string {
  const org = (params.schoolName || params.institutionName || "School Administration").toUpperCase();
  const { studentName, className, admissionNo, dueAmount, dueMonthsCount, schoolPhone } = params;
  const numAmount = typeof dueAmount === "number" ? dueAmount.toLocaleString("en-IN") : dueAmount;
  const pUrl = params.portalUrl || (params.originUrl ? `${params.originUrl}/fees` : "");

  return `🏫 *${org} - FEE REMINDER NOTICE*

Dear Parent of *${studentName}*,
Greetings from *${org}*.

This is a gentle reminder regarding the outstanding tuition fees for your child:

👤 *Student:* ${studentName} ${className ? `(Class: ${className})` : ""}
🪪 *Student ID:* ${admissionNo}
💰 *Pending Due Amount:* *₹${numAmount}*
${dueMonthsCount ? `⏳ *Overdue Period:* ${dueMonthsCount} Month(s)\n` : ""}
Kindly clear the pending balance at the school fees counter at the earliest to ensure uninterrupted academic services.

${pUrl ? `🧾 *View Digital Fee Statement & Receipts:* \n${pUrl}\n` : ""}${schoolPhone ? `📞 *Accounts Helpdesk:* ${schoolPhone}\n` : ""}
_Thank you for your cooperation!_
*Accounts & Finance Department*`;
}

export interface AttendanceSuccessParams {
  institutionName?: string;
  schoolName?: string;
  studentName: string;
  className?: string;
  admissionNo: string;
  date: string;
  time: string;
  portalUrl?: string;
  originUrl?: string;
  feeNotice?: string;
}

export function formatAttendanceSuccessMessage(params: AttendanceSuccessParams): string {
  const org = (params.schoolName || params.institutionName || "School Administration").toUpperCase();
  const { studentName, className, admissionNo, date, time, feeNotice } = params;
  const pUrl = params.portalUrl || (params.originUrl ? `${params.originUrl}/attendance` : "");

  return `🏫 *${org} - GATE ATTENDANCE NOTICE*
📅 *Date:* ${date}

Dear Parent,
Your ward *${studentName}* ${className ? `(Class: ${className})` : ""}${admissionNo ? ` [ID: ${admissionNo}]` : ""} has safely arrived at school and was marked ✅ *PRESENT* at *${time}* via Smart Gate QR Scan.
${feeNotice ? `\n💳 *Account Status:* ${feeNotice}\n` : ""}
${pUrl ? `🔗 *Check Live Attendance History:* \n${pUrl}\n` : ""}
_Regards,_
*School Safety & Security Cell*`;
}

export interface StaffCredentialsParams {
  institutionName?: string;
  staffName: string;
  roleTitle?: string;
  loginId: string;
  password?: string;
  email?: string;
  loginUrl?: string;
  assignedCount?: number;
}

export function formatStaffCredentialsMessage(params: StaffCredentialsParams): string {
  const org = (params.institutionName || "EduTechLab Institute").trim();
  const loginUrl = params.loginUrl || "https://edutechlab-9fz4.vercel.app/login";
  const role = params.roleTitle || "Staff Member";

  return `🏫 *${org.toUpperCase()}*
*Official Staff Portal Credentials*

Dear *${params.staffName}*,

Greetings! Your official staff portal account has been successfully configured. You have been granted access to manage your assigned institutional modules.

*Your Login Credentials:*
━━━━━━━━━━━━━━━━━━━━━
👤 *Designation:* ${role}
🆔 *Staff Login ID:* *${params.loginId}*
${params.password ? `🔑 *Temporary Password:* *${params.password}*\n` : ""}${params.email ? `📧 *Registered Email:* ${params.email}\n` : ""}🌐 *Portal URL:* ${loginUrl}
━━━━━━━━━━━━━━━━━━━━━

📌 *Steps to Access:*
1. Click on the Login Portal URL: ${loginUrl}
2. Select the *'Staff Login'* tab.
3. Enter your *Staff Login ID* (or registered email) and *Password*.

_Note: For security reasons, please do not disclose or forward your login credentials to unauthorized persons._

Warm regards,
*Administration Office*
*${org}*`;
}

export function formatStaffReminderMessage(params: {
  institutionName?: string;
  staffName: string;
  loginId?: string | null;
  roleTitle?: string;
  loginUrl?: string;
}): string {
  const org = (params.institutionName || "EduTechLab Institute").trim();
  const loginUrl = params.loginUrl || "https://edutechlab-9fz4.vercel.app/login";

  return `🏫 *${org.toUpperCase()}*
*Staff Portal Access Notification*

Dear *${params.staffName}*,

Here are your official staff portal login details for *${org}*:

🆔 *Staff Login ID:* *${params.loginId || "N/A"}*
${params.roleTitle ? `👤 *Designation:* ${params.roleTitle}\n` : ""}🌐 *Login Portal:* ${loginUrl}

Please access the portal using the link above, select the *'Staff Login'* tab, and enter your credentials.

Warm regards,
*Administration Office*
*${org}*`;
}
