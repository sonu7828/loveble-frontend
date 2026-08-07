import jsPDF from "jspdf";
import { format } from "date-fns";

export interface GfeRecordPdfData {
  id: string;
  client_first_name?: string | null;
  client_last_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  client_dob?: string | null;
  np_name?: string | null;
  np_license?: string | null;
  signed_at?: string | null;
  expires_at?: string | null;
  chief_concerns?: string[] | null;
  chief_concerns_notes?: string | null;
  treatment_goals?: string[] | null;
  medical_history?: string[] | null;
  medical_history_other?: string | null;
  allergies?: string[] | null;
  allergies_other?: string | null;
  current_medications?: string[] | null;
  current_medications_other?: string | null;
  prior_treatments?: string[] | null;
  prior_treatments_last_date?: string | null;
  fitzpatrick?: string | null;
  skin_assessment?: string[] | null;
  bp_systolic?: string | number | null;
  bp_diastolic?: string | number | null;
  heart_rate?: string | number | null;
  height_in?: number | null;
  weight_lb?: number | null;
  vital_signs?: {
    bp_sys?: string;
    bp_dia?: string;
    pulse?: string;
    height?: string;
    weight?: string;
  } | null;
  pregnancy_status?: string | null;
  photo_consent?: boolean | null;
  np_assessment_plan?: string | null;
  cleared_for_treatments?: string[] | null;
  cleared_other?: string | null;
  estimates?: Array<{
    service: string;
    cpt?: string;
    cost: number;
  }> | null;
  signature_png?: string | null;
  provider_signature_png?: string | null;
  patient_signature_png?: string | null;
  status?: string | null;
  created_at?: string | null;
}

export function generateGfePDF(record: GfeRecordPdfData): jsPDF {
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
  doc.setFillColor(120, 53, 36); // Rich brand brown (#783524)
  doc.rect(margin, y, contentWidth, 54, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("RADIANTILYK AESTHETICS", margin + 16, y + 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("CALIFORNIA GOOD FAITH EXAMINATION (GFE) & COST ESTIMATE", margin + 16, y + 40);

  y += 70;

  // Patient & Exam Info Card
  doc.setFillColor(250, 248, 246);
  doc.setDrawColor(226, 218, 210);
  doc.roundedRect(margin, y, contentWidth, 80, 6, 6, "FD");

  const name = `${record.client_first_name || ""} ${record.client_last_name || ""}`.trim() || "Patient";
  const email = record.client_email || "N/A";
  const phone = record.client_phone || "N/A";
  const dob = record.client_dob ? record.client_dob.slice(0, 10) : "N/A";
  const signedDate = record.signed_at
    ? format(new Date(record.signed_at), "PPP p")
    : record.created_at
    ? format(new Date(record.created_at), "PPP p")
    : "N/A";
  const expiresDate = record.expires_at ? format(new Date(record.expires_at), "PPP") : "N/A";
  const provider = record.np_name || "Nurse Practitioner";
  const license = record.np_license ? ` (Lic. ${record.np_license})` : "";

  doc.setTextColor(30, 25, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Patient: ${name}`, margin + 14, y + 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(`Email: ${email}  |  Phone: ${phone}  |  DOB: ${dob}`, margin + 14, y + 40);
  doc.text(`Examined By: ${provider}${license}`, margin + 14, y + 55);
  doc.text(`Signed: ${signedDate}  (Valid until: ${expiresDate})`, margin + 14, y + 70);

  y += 95;

  const renderSectionHeader = (title: string) => {
    checkAddPage(35);
    doc.setFillColor(242, 236, 230);
    doc.rect(margin, y, contentWidth, 20, "F");
    doc.setTextColor(60, 40, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title.toUpperCase(), margin + 10, y + 14);
    y += 28;
  };

  const renderListOrText = (label: string, items?: string[] | null, other?: string | null) => {
    checkAddPage(25);
    const combined = [
      ...(Array.isArray(items) ? items : []),
      ...(other ? [other] : [])
    ].filter(Boolean).join(", ");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(70, 50, 40);
    doc.text(`${label}:`, margin, y);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    const textLines = doc.splitTextToSize(combined || "None reported", contentWidth - 160);
    doc.text(textLines, margin + 160, y);
    y += Math.max(18, textLines.length * 12 + 4);
  };

  // Section 1: Clinical Evaluation & History
  renderSectionHeader("Clinical Evaluation & Medical History");

  renderListOrText("Chief Concerns", record.chief_concerns, record.chief_concerns_notes);
  renderListOrText("Treatment Goals", record.treatment_goals);
  renderListOrText("Medical History", record.medical_history, record.medical_history_other);
  renderListOrText("Current Medications", record.current_medications, record.current_medications_other);
  renderListOrText("Known Allergies", record.allergies, record.allergies_other);
  renderListOrText(
    "Prior Aesthetic Treatments",
    record.prior_treatments,
    record.prior_treatments_last_date ? `Last: ${record.prior_treatments_last_date}` : null
  );

  y += 10;

  // Section 2: Skin Assessment & Vitals
  renderSectionHeader("Physical Exam, Skin Assessment & Vitals");

  const fitz = record.fitzpatrick ? `Fitzpatrick Scale: ${record.fitzpatrick}` : "";
  renderListOrText("Skin Assessment", record.skin_assessment, fitz);

  // Formatted Vitals
  const bpSys = record.bp_systolic || record.vital_signs?.bp_sys;
  const bpDia = record.bp_diastolic || record.vital_signs?.bp_dia;
  const bp = bpSys && bpDia ? `${bpSys}/${bpDia} mmHg` : bpSys ? `${bpSys} mmHg` : "N/A";
  const hr = record.heart_rate || record.vital_signs?.pulse ? `${record.heart_rate || record.vital_signs?.pulse} bpm` : "N/A";
  
  let ht = "N/A";
  if (record.height_in) {
    const feet = Math.floor(record.height_in / 12);
    const inches = record.height_in % 12;
    ht = `${feet}′${inches}″`;
  } else if (record.vital_signs?.height) {
    ht = record.vital_signs.height;
  }

  const wt = record.weight_lb ? `${record.weight_lb} lb` : record.vital_signs?.weight ? record.vital_signs.weight : "N/A";

  renderListOrText("Vital Signs", [`BP: ${bp}`, `Pulse: ${hr}`, `Height: ${ht}`, `Weight: ${wt}`]);
  renderListOrText("Pregnancy / Lactation", record.pregnancy_status ? [record.pregnancy_status] : ["Not applicable"]);
  renderListOrText("Photo Consent", [record.photo_consent ? "Granted" : "Declined"]);

  y += 10;

  // Section 3: NP Assessment & Plan
  if (record.np_assessment_plan || record.cleared_for_treatments?.length) {
    renderSectionHeader("NP Clinical Assessment & Treatment Plan");

    if (record.cleared_for_treatments?.length) {
      renderListOrText("Approved Procedures", record.cleared_for_treatments, record.cleared_other);
    }

    if (record.np_assessment_plan) {
      checkAddPage(40);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);

      const planLines = record.np_assessment_plan.split("\n");
      planLines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) {
          y += 6;
          return;
        }

        checkAddPage(15);
        if (
          trimmed.startsWith("VISIT MODALITY:") ||
          trimmed.startsWith("ASSESSMENT:") ||
          trimmed.startsWith("BOOKED TREATMENTS:") ||
          trimmed.startsWith("ADDITIONALLY APPROVED TREATMENTS:") ||
          trimmed.startsWith("PLAN:") ||
          trimmed.startsWith("NOTES:") ||
          trimmed.startsWith("TELEVISIT ATTESTATIONS:")
        ) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.5);
          doc.setTextColor(70, 50, 40);
          doc.text(trimmed, margin, y);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(30, 30, 30);
          y += 14;
        } else {
          const textLines = doc.splitTextToSize(trimmed, contentWidth - 10);
          doc.text(textLines, margin + 5, y);
          y += textLines.length * 12 + 3;
        }
      });
      y += 10;
    }
  }

  // Section 4: Cost Estimates (if present)
  if (Array.isArray(record.estimates) && record.estimates.length > 0) {
    renderSectionHeader("Good Faith Itemized Cost Estimate");
    
    checkAddPage(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(90, 80, 70);
    doc.text("SERVICE / PROCEDURE", margin + 10, y);
    doc.text("CPT / CODE", margin + 280, y);
    doc.text("ESTIMATED COST", margin + 420, y);
    y += 10;

    doc.setDrawColor(210, 200, 190);
    doc.line(margin, y, margin + contentWidth, y);
    y += 15;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    let grandTotal = 0;

    record.estimates.forEach((est) => {
      checkAddPage(20);
      const serviceName = est.service || "Aesthetic Treatment";
      const cpt = est.cpt || "—";
      const cost = Number(est.cost) || 0;
      grandTotal += cost;

      doc.text(serviceName, margin + 10, y);
      doc.text(cpt, margin + 280, y);
      doc.text(`$${cost.toFixed(2)}`, margin + 420, y);
      y += 18;
    });

    y += 5;
    doc.line(margin, y, margin + contentWidth, y);
    y += 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("ESTIMATED TOTAL:", margin + 280, y);
    doc.text(`$${grandTotal.toFixed(2)}`, margin + 420, y);
    y += 25;
  }

  // Section 5: Signatures & Authorization
  checkAddPage(110);
  renderSectionHeader("Practitioner Authorization & Signatures");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 90, 80);
  doc.text(
    "I certify that I have conducted a Good Faith Exam for this patient and evaluated their medical history prior to prescribing aesthetic procedures.",
    margin,
    y
  );

  y += 20;

  const sigImg = record.signature_png || record.provider_signature_png;
  if (sigImg) {
    try {
      doc.addImage(sigImg, "PNG", margin, y, 160, 45);
    } catch {
      doc.setFont("helvetica", "bold");
      doc.text("[ Signed Electronically ]", margin, y + 25);
    }
  } else {
    doc.setFont("helvetica", "italic");
    doc.text("[ Provider Signed Electronically ]", margin, y + 25);
  }

  if (record.patient_signature_png) {
    try {
      doc.addImage(record.patient_signature_png, "PNG", margin + 260, y, 160, 45);
    } catch {
      doc.setFont("helvetica", "bold");
      doc.text("[ Patient Signed ]", margin + 260, y + 25);
    }
  }

  y += 55;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(40, 40, 40);
  doc.text(`Nurse Practitioner: ${provider}${license}`, margin, y);
  if (record.signed_at || record.created_at) {
    doc.text(
      `Date Signed: ${format(new Date(record.signed_at || record.created_at!), "PPP p")}`,
      margin + 260,
      y
    );
  }

  // Footer Page Numbers
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 130, 120);
    doc.text(
      `Radiantilyk Aesthetics GFE — Confidential Medical Record — Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 20,
      { align: "center" }
    );
  }

  return doc;
}
