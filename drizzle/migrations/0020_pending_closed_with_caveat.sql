-- Permite encerrar uma investigação de estoque sem classificá-la como perda.
-- Reversão, só quando nenhuma linha usar o status novo:
--   DELETE não é feito aqui.
--   ALTER TABLE public.operational_pendings DROP CONSTRAINT operational_pendings_status_check;
--   ALTER TABLE public.operational_pendings ADD CONSTRAINT operational_pendings_status_check
--     CHECK (status IN ('open', 'resolved', 'converted_to_loss'));

ALTER TABLE public.operational_pendings DROP CONSTRAINT IF EXISTS operational_pendings_status_check;

ALTER TABLE public.operational_pendings
  ADD CONSTRAINT operational_pendings_status_check
  CHECK (status IN ('open', 'resolved', 'converted_to_loss', 'closed_with_caveat'));
