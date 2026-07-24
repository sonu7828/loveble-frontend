UPDATE public.clinical_notes
   SET status = 'draft',
       signed_at = NULL,
       cosigned_at = NULL,
       locked_at = NULL,
       updated_at = now()
 WHERE id = '00bc145c-ec21-40d4-802a-547dda222ceb';

DELETE FROM public.clinical_note_signatures
 WHERE clinical_note_id = '00bc145c-ec21-40d4-802a-547dda222ceb';