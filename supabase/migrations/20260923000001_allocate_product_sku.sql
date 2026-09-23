-- Persistent high-water marks: deletions and failed product inserts never
-- recycle an allocated number. Apply before deploying the new API.
BEGIN;
LOCK TABLE public.products IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE public.product_sku_counters (
  prefix TEXT PRIMARY KEY,
  last_value NUMERIC NOT NULL CHECK (last_value >= 0 AND last_value = trunc(last_value))
);
ALTER TABLE public.product_sku_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_sku_counters FROM PUBLIC, anon, authenticated;

-- Include inactive products and use the greatest suffix, never the row count.
INSERT INTO public.product_sku_counters (prefix, last_value)
SELECT upper(parts[1]), max(parts[2]::numeric)
FROM public.products
CROSS JOIN LATERAL regexp_match(btrim(sku), '^(.*)-([0-9]+)$') AS parts
WHERE parts IS NOT NULL
GROUP BY upper(parts[1]);

CREATE FUNCTION public.allocate_product_sku(p_prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  next_number TEXT;
BEGIN
  IF NOT public.is_admin_or_super_admin() THEN
    RAISE EXCEPTION 'Active administrator role required' USING ERRCODE = '42501';
  END IF;
  IF p_prefix IS NULL OR p_prefix !~ '^[A-Z0-9]{0,3}-[A-Z0-9]{0,8}$' THEN
    RAISE EXCEPTION 'Invalid SKU prefix' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.product_sku_counters AS counters (prefix, last_value)
  VALUES (p_prefix, 1)
  ON CONFLICT (prefix) DO UPDATE SET last_value = counters.last_value + 1
  RETURNING last_value::text INTO next_number;

  -- lpad with a fixed width would truncate numbers after 999.
  RETURN p_prefix || '-' || lpad(next_number, greatest(3, length(next_number)), '0');
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_product_sku(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.allocate_product_sku(TEXT) TO authenticated;
COMMIT;
