-- Força o recarregamento do cache do esquema da API (PostgREST)
NOTIFY pgrst, 'reload schema';