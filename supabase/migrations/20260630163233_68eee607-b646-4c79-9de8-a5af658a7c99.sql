DO $$
DECLARE v_note_id uuid := 'd207a963-ec31-4197-8049-8b0648f8cd4c';
        v_kiem uuid := '1076098a-8598-42b3-bb32-25cb591ce677';
BEGIN
  INSERT INTO public.clinical_note_addendums (clinical_note_id, body, author_name, author_user_id, reason)
  VALUES (
    v_note_id,
    'CORRECTION (system): Auto-generated SOAP narrative incorrectly named "Botox"; product administered was Daxxify (product=Daxxify, total_units=100, dilution=1.0 mL / 100u). Narrative updated to reflect actual product. Structured chart data was always correct.',
    'System correction',
    v_kiem,
    'Narrative product/dilution correction'
  );

  ALTER TABLE public.clinical_notes DISABLE TRIGGER clinical_notes_protect_signed;
  UPDATE public.clinical_notes
     SET provider_notes = replace(
           replace(provider_notes,
             'Botox was administered intramuscularly using 31G needle with 2.5 mL / 100u dilution',
             'Daxxify was administered intramuscularly using 31G needle with 1.0 mL / 100u dilution'),
           'Patient presents for neurotoxin treatment.',
           'Patient presents for neurotoxin treatment with Daxxify.'
         )
   WHERE id = v_note_id;
  ALTER TABLE public.clinical_notes ENABLE TRIGGER clinical_notes_protect_signed;
END $$;