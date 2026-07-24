DELETE FROM public.client_points_ledger
WHERE reason = 'earned'
  AND sale_id IS NULL
  AND notes LIKE 'Manual: earned on%'
  AND client_email IN ('adriana_0305@yahoo.com','jannahful@gmail.com','lc6362@gmail.com');