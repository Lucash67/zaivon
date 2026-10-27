-- Horário vazio = horário desconhecido. Quantidade vazia na pendência = contagem desconhecida.
-- Zero continua significando ausência real de unidades. Dias já gravados não mudam.
ALTER TABLE public.sales ALTER COLUMN sale_time DROP NOT NULL;

ALTER TABLE public.operational_pendings ALTER COLUMN quantity DROP NOT NULL;

ALTER TABLE public.operational_pendings
  DROP CONSTRAINT IF EXISTS operational_pendings_quantity_known_check;

ALTER TABLE public.operational_pendings
  ADD CONSTRAINT operational_pendings_quantity_known_check
  CHECK (quantity IS NULL OR quantity >= 0);
