import jsPDF from "jspdf";
import { format } from "date-fns";

export interface ChartNotePdfData {
  note: {
    id: string;
    client_first_name?: string | null;
    client_last_name?: string | null;
    client_email?: string | null;
    client_phone?: string | null;
    client_dob?: string | null;
    service_name?: string | null;
    category?: string | null;
    provider_name?: string | null;
    provider_role?: string | null;
    status?: string | null;
    signed_at?: string | null;
    created_at?: string | null;
    indication?: string | null;
    provider_notes?: string | null;
    bp_systolic?: number | string | null;
    bp_diastolic?: number | string | null;
    heart_rate?: number | string | null;
    followup_weeks?: number | string | null;
    post_op_reviewed?: boolean | null;
    post_assessment?: string[] | null;
    photo_pre_paths?: string[] | null;
    photo_post_paths?: string[] | null;
  };
  detail?: Record<string, any> | null;
  sigs?: Array<{
    signer_name?: string;
    signer_role?: string;
    signed_at?: string;
    signature_png?: string;
  }>;
  addendums?: Array<{
    reason?: string;
    author_name?: string;
    author_role?: string;
    body?: string;
    created_at?: string;
    signature_png?: string;
  }>;
}

export function generateChartNotePDF(data: ChartNotePdfData): jsPDF {
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

  const { note, detail, sigs = [], addendums = [] } = data;
  const patientName = `${note.client_first_name || ""} ${note.client_last_name || ""}`.trim() || note.client_email || "Patient";

  // Header Banner
  doc.setFillColor(120, 53, 36); // Rich brand brown (#783524)
  doc.rect(margin, y, contentWidth, 54, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("RADIANTILYK AESTHETICS", margin + 16, y + 23);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("CONFIDENTIAL CLINICAL EMR CHART NOTE & TREATMENT RECORD", margin + 16, y + 40);

  y += 68;

  // Patient Info Card
  doc.setFillColor(248, 246, 243);
  doc.setDrawColor(220, 210, 200);
  doc.roundedRect(margin, y, contentWidth, 68, 6, 6, "FD");

  doc.setTextColor(40, 30, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Patient: ${patientName}`, margin + 14, y + 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(`Email: ${note.client_email || "N/A"}   |   DOB: ${note.client_dob || "N/A"}`, margin + 14, y + 40);

  const noteDate = note.signed_at || note.created_at ? format(new Date(note.signed_at || note.created_at!), "PPP p") : "Recently";
  doc.text(`Date of Service: ${noteDate}   |   Status: ${(note.status || "Signed").toUpperCase()}`, margin + 14, y + 55);

  y += 82;

  const renderSectionHeader = (title: string) => {
    checkAddPage(35);
    doc.setFillColor(240, 235, 228);
    doc.rect(margin, y, contentWidth, 20, "F");
    doc.setTextColor(60, 40, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title.toUpperCase(), margin + 10, y + 14);
    y += 28;
  };

  // Section 1: Service & Provider Info
  renderSectionHeader("Procedure & Provider Information");
  doc.setFontSize(9.5);
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "bold");
  doc.text("Service Documented:", margin + 10, y);
  doc.setFont("helvetica", "normal");
  doc.text(note.service_name || note.category || "Aesthetic Treatment", margin + 140, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.text("Treating Provider:", margin + 10, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${note.provider_name || "Provider"} (${note.provider_role || "Clinician"})`, margin + 140, y);
  y += 16;

  if (note.indication) {
    doc.setFont("helvetica", "bold");
    doc.text("Indication:", margin + 10, y);
    doc.setFont("helvetica", "normal");
    doc.text(note.indication, margin + 140, y);
    y += 16;
  }
  y += 10;

  // Section 2: Clinical Details (if available)
  if (detail && Object.keys(detail).length > 0) {
    renderSectionHeader("Treatment & Product Details");
    doc.setFontSize(9);

    const keys = Object.keys(detail).filter(k => k !== "clinical_note_id" && k !== "id");
    for (const k of keys) {
      checkAddPage(18);
      const label = k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      const val = detail[k];
      let valStr = "";
      if (Array.isArray(val)) {
        valStr = val.join(", ");
      } else if (typeof val === "object" && val !== null) {
        valStr = JSON.stringify(val);
      } else {
        valStr = String(val ?? "—");
      }

      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, margin + 10, y);
      doc.setFont("helvetica", "normal");

      const splitText = doc.splitTextToSize(valStr, contentWidth - 160);
      doc.text(splitText, margin + 150, y);
      y += Math.max(16, splitText.length * 12);
    }
    y += 10;
  }

  // Section 3: Vitals & Post-Procedure
  renderSectionHeader("Vitals & Post-Procedure Assessment");
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");

  const vitalsText = [
    note.bp_systolic ? `BP: ${note.bp_systolic}/${note.bp_diastolic || "—"}` : null,
    note.heart_rate ? `Heart Rate: ${note.heart_rate} bpm` : null,
    note.followup_weeks ? `Follow-up: In ${note.followup_weeks} weeks` : null,
    note.post_op_reviewed ? "Post-Op Instructions: Reviewed with patient" : null,
  ].filter(Boolean).join("   |   ");

  doc.text(vitalsText || "Vitals stable. Standard post-op instructions reviewed.", margin + 10, y);
  y += 20;

  if (note.post_assessment && note.post_assessment.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("Post Assessment:", margin + 10, y);
    doc.setFont("helvetica", "normal");
    doc.text(note.post_assessment.join(", "), margin + 130, y);
    y += 20;
  }

  // Section 4: Provider Notes
  if (note.provider_notes) {
    renderSectionHeader("Provider Clinical Notes & SOAP Narrative");
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const splitNotes = doc.splitTextToSize(note.provider_notes, contentWidth - 20);
    checkAddPage(splitNotes.length * 12 + 10);
    doc.text(splitNotes, margin + 10, y);
    y += splitNotes.length * 12 + 15;
  }

  // Section 5: Clinical Pre & Post Treatment Photos
  const prePhotos = note.photo_pre_paths || [];
  const postPhotos = note.photo_post_paths || [];
  const totalPhotos = prePhotos.length + postPhotos.length;

  if (totalPhotos > 0) {
    let localPhotos: Record<string, string> = {};
    try {
      localPhotos = JSON.parse(localStorage.getItem("rka_demo_photos") || "{}");
    } catch {}

    renderSectionHeader(`Clinical Treatment Photos (${totalPhotos})`);

    const renderPhotoGrid = (title: string, paths: string[]) => {
      if (!paths || !paths.length) return;
      checkAddPage(140);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(60, 40, 30);
      doc.text(`${title} (${paths.length}):`, margin + 10, y);
      y += 14;

      const photoWidth = 150;
      const photoHeight = 112;
      let xOffset = margin + 10;

      for (let i = 0; i < paths.length; i++) {
        const p = paths[i];
        const imgData = localPhotos[p] || (p.startsWith("data:") || p.startsWith("http") ? p : null);

        if (xOffset + photoWidth > margin + contentWidth) {
          xOffset = margin + 10;
          y += photoHeight + 14;
          checkAddPage(photoHeight + 18);
        }

        if (imgData && typeof imgData === "string" && imgData.trim().length > 20) {
          try {
            const fmt = imgData.includes("image/jpeg") || imgData.includes("image/jpg") ? "JPEG" : "PNG";
            doc.addImage(imgData, fmt, xOffset, y, photoWidth, photoHeight);
          } catch {
            try {
              doc.addImage(imgData, xOffset, y, photoWidth, photoHeight);
            } catch {
              doc.setFillColor(235, 230, 225);
              doc.rect(xOffset, y, photoWidth, photoHeight, "F");
              doc.setFont("helvetica", "normal");
              doc.setFontSize(8);
              doc.text("[ Clinical Photo Attached ]", xOffset + 15, y + photoHeight / 2);
            }
          }
        } else {
          doc.setFillColor(235, 230, 225);
          doc.rect(xOffset, y, photoWidth, photoHeight, "F");
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.text("[ Clinical Photo Attached ]", xOffset + 15, y + photoHeight / 2);
        }

        xOffset += photoWidth + 15;
      }
      y += photoHeight + 20;
    };

    if (prePhotos.length > 0) renderPhotoGrid("Pre-Procedure Photos", prePhotos);
    if (postPhotos.length > 0) renderPhotoGrid("Post-Procedure Photos", postPhotos);
  }

  // Section 6: Signatures
  checkAddPage(100);
  renderSectionHeader("Signatures & Verification");
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  doc.text("I attest that this clinical record is a true and accurate documentation of the treatment performed.", margin + 10, y);
  y += 18;

  if (sigs.length > 0) {
    for (const s of sigs) {
      checkAddPage(60);
      if (s.signature_png && typeof s.signature_png === "string" && s.signature_png.trim().length > 20) {
        try {
          const format = s.signature_png.includes("image/jpeg") || s.signature_png.includes("image/jpg") ? "JPEG" : "PNG";
          doc.addImage(s.signature_png, format, margin + 10, y, 150, 40);
          y += 44;
        } catch {
          try {
            doc.addImage(s.signature_png, margin + 10, y, 150, 40);
            y += 44;
          } catch {
            doc.setFont("helvetica", "bold");
            doc.text(`[ ${s.signer_name} - Signed Electronically ]`, margin + 10, y + 15);
            y += 25;
          }
        }
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      doc.text(`${s.signer_name || "Provider"} (${s.signer_role || "Clinician"})`, margin + 10, y);
      if (s.signed_at) {
        doc.setFont("helvetica", "normal");
        doc.text(`Signed: ${format(new Date(s.signed_at), "PPP p")}`, margin + 220, y);
      }
      y += 20;
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.text(`[ Signed Electronically by ${note.provider_name || "Provider"} ]`, margin + 10, y + 10);
    y += 25;
  }

  // Section 6: Addendums & Corrections (if any)
  if (addendums.length > 0) {
    checkAddPage(60);
    renderSectionHeader(`Addendums & Corrections (${addendums.length})`);
    for (const a of addendums) {
      checkAddPage(70);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(180, 40, 40); // Red highlight for corrections
      doc.text(`Reason: ${a.reason || "Correction"}`, margin + 10, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 100);
      const dateStr = a.created_at ? format(new Date(a.created_at), "PPP p") : "Recently";
      doc.text(`By: ${a.author_name || "Clinician"} (${a.author_role || "Staff"}) on ${dateStr}`, margin + 200, y);
      y += 16;

      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      const splitBody = doc.splitTextToSize(a.body || "", contentWidth - 20);
      doc.text(splitBody, margin + 10, y);
      y += splitBody.length * 12 + 10;

      if (a.signature_png) {
        try {
          doc.addImage(a.signature_png, "PNG", margin + 10, y, 120, 32);
          y += 36;
        } catch {}
      }
      y += 10;
    }
  }

  // Page Numbers
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 130, 120);
    doc.text(
      `Radiantilyk Aesthetics EMR — Confidential Medical Record — Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 20,
      { align: "center" }
    );
  }

  return doc;
}
