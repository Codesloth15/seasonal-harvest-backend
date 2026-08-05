CREATE OR REPLACE FUNCTION public.delete_brand_with_products(target_brand_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  deleted_product_count INTEGER;
  deleted_brand_count INTEGER;
BEGIN
  DELETE FROM public.products
  WHERE brand_id = target_brand_id;
  GET DIAGNOSTICS deleted_product_count = ROW_COUNT;

  DELETE FROM public.brands
  WHERE id = target_brand_id;
  GET DIAGNOSTICS deleted_brand_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'brandDeleted', deleted_brand_count = 1,
    'deletedProducts', deleted_product_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_brand_with_products(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_brand_with_products(UUID) TO authenticated;
