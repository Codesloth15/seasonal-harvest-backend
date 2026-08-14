-- Treat inventory with 10 or fewer available units as low stock by default.
ALTER TABLE public.inventory
  ALTER COLUMN low_stock_threshold SET DEFAULT 10;

-- Rows initialized under the previous zero default should use the new boundary.
UPDATE public.inventory
SET low_stock_threshold = 10
WHERE low_stock_threshold = 0;
