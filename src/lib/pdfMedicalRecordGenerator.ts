import jsPDF from "jspdf";
import { format } from "date-fns";

export interface ExportData {
  exportedAt: string;
  patientProfile: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    dob?: string;
    [key: string]: any;
  };
  clinicalNotes?: Array<{
    created_at: string;
    category?: string;
    service_name?: string;
    provider_name?: string;
    note_body?: string;
    status?: string;
  }>;
  consentSignatures?: Array<{
    signed_at: string;
    signed_full_name?: string;
    decision?: string;
    form_version?: number;
  }>;
  appointments?: Array<{
    start_at: string;
    status?: string;
  }>;
  billingReceipts?: Array<{
    paid_at?: string;
    total_cents?: number;
    status?: string;
  }>;
}

export function generateMedicalRecordPDF(data: ExportData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 40;
  let y = margin;
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const contentWidth = pageWidth - margin * 2;

  const checkAddPage = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Header Banner
  doc.setFillColor(30, 41, 59); // Dark slate (#1e293b)
  doc.rect(margin, y, contentWidth, 54, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("RADIANTILYK HEALTHCARE PLATFORM", margin + 16, y + 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("HIPAA §164.524 OFFICIAL PERSONAL HEALTH RECORD EXPORT", margin + 16, y + 40);

  y += 70;

  // Patient Info Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 70, 6, 6, "FD");

  const name = `${data.patientProfile.first_name || ""} ${data.patientProfile.last_name || ""}`.trim() || "Patient";
  const email = data.patientProfile.email || "N/A";
  const phone = data.patientProfile.phone || "N/A";
  const dob = data.patientProfile.dob || "N/A";

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Patient Name: ${name}`, margin + 14, y + 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Email: ${email}  |  Phone: ${phone}  |  DOB: ${dob}`, margin + 14, y + 40);
  doc.text(`Export Date: ${format(new Date(data.exportedAt), "PPPP 'at' p")}`, margin + 14, y + 56);

  y += 85;

  // Section Helper
  const renderSectionHeader = (title: string) => {
    checkAddPage(40);
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 22, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, margin + 10, y + 15);
    y += 30;
  };

  // 1. Clinical SOAP Notes
  if (data.clinicalNotes && data.clinicalNotes.length > 0) {
    renderSectionHeader(`1. Clinical SOAP & Chart Notes (${data.clinicalNotes.length} Records)`);
    for (const note of data.clinicalNotes) {
      checkAddPage(60);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const noteDate = note.created_at ? format(new Date(note.created_at), "yyyy-MM-dd HH:mm") : "N/A";
      doc.text(`[${noteDate}] ${note.service_name || "Clinical Note"} — Provider: ${note.provider_name || "Staff"}`, margin + 10, y);
      y += 14;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      const body = note.note_body || "Chart details signed and locked on file.";
      const lines = doc.splitTextToSize(body, contentWidth - 20);
      doc.text(lines, margin + 10, y);
      y += lines.length * 12 + 10;
      doc.setTextColor(15, 23, 42);
    }
    y += 10;
  }

  // 2. Signed Consent Forms
  if (data.consentSignatures && data.consentSignatures.length > 0) {
    renderSectionHeader(`2. Signed Consent Forms (${data.consentSignatures.length} Records)`);
    for (const sig of data.consentSignatures) {
      checkAddPage(25);
      const sigDate = sig.signed_at ? format(new Date(sig.signed_at), "yyyy-MM-dd HH:mm") : "N/A";
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(`• Signed by ${sig.signed_full_name || name} on ${sigDate} (Decision: ${sig.decision || "agreed"})`, margin + 10, y);
      y += 16;
    }
    y += 10;
  }

  // 3. Appointments
  if (data.appointments && data.appointments.length > 0) {
    renderSectionHeader(`3. Visit & Appointment History (${data.appointments.length} Records)`);
    for (const appt of data.appointments) {
      checkAddPage(22);
      const apptDate = appt.start_at ? format(new Date(appt.start_at), "PPPP 'at' p") : "N/A";
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(`• ${apptDate} — Status: ${appt.status || "completed"}`, margin + 10, y);
      y += 16;
    }
    y += 10;
  }

  // 4. Billing Receipts
  if (data.billingReceipts && data.billingReceipts.length > 0) {
    renderSectionHeader(`4. Billing & Financial Receipts (${data.billingReceipts.length} Records)`);
    for (const receipt of data.billingReceipts) {
      checkAddPage(22);
      const paidDate = receipt.paid_at ? format(new Date(receipt.paid_at), "yyyy-MM-dd") : "N/A";
      const amount = receipt.total_cents ? `$${(receipt.total_cents / 100).toFixed(2)}` : "$0.00";
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(`• Payment Date: ${paidDate} | Amount: ${amount} | Status: ${receipt.status || "paid"}`, margin + 10, y);
      y += 16;
    }
    y += 10;
  }

  // Footer on all pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Confidential Personal Health Record — Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 20,
      { align: "center" }
    );
  }

  return doc;
}
