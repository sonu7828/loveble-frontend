ALTER TABLE clinical_protocol_versions DISABLE TRIGGER USER;
UPDATE clinical_protocol_versions
SET patient_handout_md = REPLACE(patient_handout_md,
  'Approved by Kiem Vukadinovic, NP — Medical Director, Radiantilyk Aesthetic. Aligned with CA Board of Registered Nursing standardized procedures (CCR §1474) and CA Medical Board guidance for medical spas.',
  'Authored by Kiem Vukadinovic, NP — Founder & Nurse Practitioner, Radiantilyk Aesthetic. Medical Director: Aloysius N. Fobi, MD — Supervising Physician. Aligned with CA Board of Registered Nursing standardized procedures (CCR §1474) and CA Medical Board guidance for medical spas.'),
  regulatory_basis = REPLACE(regulatory_basis,
  'Approved by Kiem Vukadinovic, NP — Medical Director, Radiantilyk Aesthetic. Aligned with CA Board of Registered Nursing standardized procedures (CCR §1474) and CA Medical Board guidance for medical spas.',
  'Authored by Kiem Vukadinovic, NP — Founder & Nurse Practitioner, Radiantilyk Aesthetic. Medical Director: Aloysius N. Fobi, MD — Supervising Physician. Aligned with CA Board of Registered Nursing standardized procedures (CCR §1474) and CA Medical Board guidance for medical spas.')
WHERE patient_handout_md ILIKE '%NP — Medical Director%' OR regulatory_basis ILIKE '%NP — Medical Director%';
ALTER TABLE clinical_protocol_versions ENABLE TRIGGER USER;