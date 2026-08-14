import { createAuthenticatedSupabaseClient } from "../config/supabase.js";

export const getDashboardSourceData = async ({ from, toExclusive }, accessToken) => {
  const client = createAuthenticatedSupabaseClient(accessToken);

  const [productsResult, inventoryResult, transactionsResult] = await Promise.all([
    client
      .from("products")
      .select("id, category_id, brand_id, product_type, is_active"),
    client
      .from("inventory")
      .select(
        "id, quantity_on_hand, reserved_quantity, available_quantity, low_stock_threshold, product:products(id, price, is_active)",
      ),
    client
      .from("inventory_transactions")
      .select("operation, quantity_change, created_at")
      .gte("created_at", from)
      .lt("created_at", toExclusive)
      .order("created_at", { ascending: true }),
  ]);

  for (const result of [productsResult, inventoryResult, transactionsResult]) {
    if (result.error) throw result.error;
  }

  return {
    products: productsResult.data ?? [],
    inventory: inventoryResult.data ?? [],
    transactions: transactionsResult.data ?? [],
  };
};

export const getDashboardTransactionLog = async (filters, accessToken) => {
  const client = createAuthenticatedSupabaseClient(accessToken);
  const fromRow = (filters.page - 1) * filters.limit;
  const toRow = fromRow + filters.limit - 1;

  let query = client
    .from("inventory_transactions")
    .select(
      "id, inventory_id, product_id, operation, transaction_type, requested_quantity, requested_unit, base_units_per_requested_unit, quantity_change, previous_quantity, new_quantity, reference_type, reference_id, reason, performed_by, created_at, product:products(id, name, sku, unit, image_url)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.toExclusive) query = query.lt("created_at", filters.toExclusive);
  if (filters.operation) query = query.eq("operation", filters.operation);
  if (filters.transactionType) {
    query = query.eq("transaction_type", filters.transactionType);
  }

  const { data, error, count } = await query.range(fromRow, toRow);
  if (error) throw error;

  const total = count ?? 0;
  return {
    items: data ?? [],
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / filters.limit),
    },
  };
};
