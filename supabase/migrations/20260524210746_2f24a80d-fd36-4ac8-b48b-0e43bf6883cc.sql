
insert into storage.buckets (id, name, public)
values ('sale-receipts', 'sale-receipts', false)
on conflict (id) do nothing;

create policy "Staff manage sale receipts"
on storage.objects for all to authenticated
using (bucket_id = 'sale-receipts' and (public.is_staff_or_admin(auth.uid()) or public.is_scheduler_or_admin(auth.uid())))
with check (bucket_id = 'sale-receipts' and (public.is_staff_or_admin(auth.uid()) or public.is_scheduler_or_admin(auth.uid())));

create policy "Clients read own sale receipts"
on storage.objects for select to authenticated
using (
  bucket_id = 'sale-receipts'
  and public.current_client_email() is not null
  and (storage.foldername(name))[1] = public.current_client_email()
);
