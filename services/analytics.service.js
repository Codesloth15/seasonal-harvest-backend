import * as AnalyticsRepository from "../model/analytics.model.js";
import { badRequest } from "../utils/http-error.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const GRANULARITIES = new Set(["day", "week", "month"]);
const MAX_RANGE_DAYS = 366;
const OPERATIONS = new Set(["ADD", "SUBTRACT"]);
const TRANSACTION_TYPES = new Set([
  "STOCK_RECEIVED", "ORDER_RESERVED", "ORDER_RELEASED", "ORDER_COMPLETED",
  "CUSTOMER_RETURN", "SUPPLIER_RETURN", "DAMAGED", "EXPIRED", "MISSING",
  "MANUAL_ADJUSTMENT", "INITIAL_STOCK",
]);

const toDateKey = (date) => date.toISOString().slice(0, 10);

const parseDate = (value, field) => {
  if (!DATE_PATTERN.test(value)) throw badRequest(`${field} must use YYYY-MM-DD format.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || toDateKey(date) !== value) {
    throw badRequest(`${field} must be a valid calendar date.`);
  }
  return date;
};

const addUtcDays = (date, days) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const periodStart = (timestamp, granularity) => {
  const date = new Date(timestamp);
  if (granularity === "month") {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
  }
  if (granularity === "week") {
    const day = date.getUTCDay();
    date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  }
  return toDateKey(date);
};

const number = (value) => Number(value ?? 0);

const summarizeCatalog = (products) => ({
  totalProducts: products.length,
  activeProducts: products.filter((product) => product.is_active).length,
  inactiveProducts: products.filter((product) => !product.is_active).length,
  brandedProducts: products.filter((product) => product.product_type === "BRANDED").length,
  unbrandedProducts: products.filter((product) => product.product_type === "UNBRANDED").length,
});

const summarizeInventory = (rows) => {
  const activeRows = rows.filter((row) => row.product?.is_active !== false);
  const totals = activeRows.reduce((summary, row) => {
    const onHand = number(row.quantity_on_hand);
    const reserved = number(row.reserved_quantity);
    const available = number(row.available_quantity);
    const threshold = number(row.low_stock_threshold);
    const price = number(row.product?.price);
    summary.totalQuantityOnHand += onHand;
    summary.totalReservedQuantity += reserved;
    summary.totalAvailableQuantity += available;
    summary.inventoryRetailValue += onHand * price;
    if (available <= threshold) summary.lowStockCount += 1;
    if (available === 0) summary.outOfStockCount += 1;
    return summary;
  }, {
    totalQuantityOnHand: 0,
    totalReservedQuantity: 0,
    totalAvailableQuantity: 0,
    inventoryRetailValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  });

  return { inventoryItemCount: activeRows.length, ...totals, currency: "PHP" };
};

const summarizeMovements = (transactions, granularity) => {
  const buckets = new Map();
  let totalAdditions = 0;
  let totalSubtractions = 0;

  for (const transaction of transactions) {
    const quantity = Math.abs(number(transaction.quantity_change));
    const additions = transaction.operation === "ADD" ? quantity : 0;
    const subtractions = transaction.operation === "SUBTRACT" ? quantity : 0;
    totalAdditions += additions;
    totalSubtractions += subtractions;

    const period = periodStart(transaction.created_at, granularity);
    const bucket = buckets.get(period) ?? {
      period, additions: 0, subtractions: 0, netChange: 0, transactionCount: 0,
    };
    bucket.additions += additions;
    bucket.subtractions += subtractions;
    bucket.netChange += additions - subtractions;
    bucket.transactionCount += 1;
    buckets.set(period, bucket);
  }

  return {
    transactionCount: transactions.length,
    totalAdditions,
    totalSubtractions,
    netChange: totalAdditions - totalSubtractions,
    series: [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period)),
  };
};

export const getDashboardAnalytics = async (input = {}, accessToken, now = new Date()) => {
  const granularity = typeof input.granularity === "string"
    ? input.granularity.trim().toLowerCase()
    : "day";
  if (!GRANULARITIES.has(granularity)) {
    throw badRequest("Granularity must be day, week, or month.");
  }

  const defaultTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const toDate = input.to ? parseDate(input.to, "to") : defaultTo;
  const fromDate = input.from ? parseDate(input.from, "from") : addUtcDays(toDate, -29);
  if (fromDate > toDate) throw badRequest("from must be on or before to.");
  const rangeDays = Math.round((toDate - fromDate) / 86400000) + 1;
  if (rangeDays > MAX_RANGE_DAYS) {
    throw badRequest(`Date range must not exceed ${MAX_RANGE_DAYS} days.`);
  }

  const range = {
    from: toDateKey(fromDate),
    to: toDateKey(toDate),
    granularity,
  };
  const source = await AnalyticsRepository.getDashboardSourceData(
    {
      from: `${range.from}T00:00:00.000Z`,
      toExclusive: addUtcDays(toDate, 1).toISOString(),
    },
    accessToken,
  );

  return {
    range,
    catalog: summarizeCatalog(source.products),
    inventory: summarizeInventory(source.inventory),
    movements: summarizeMovements(source.transactions, granularity),
  };
};

export const getDashboardTransactions = async (input = {}, accessToken) => {
  const page = input.page === undefined ? 1 : Number(input.page);
  const limit = input.limit === undefined ? 20 : Number(input.limit);
  const operation = typeof input.operation === "string"
    ? input.operation.trim().toUpperCase()
    : "";
  const transactionType = typeof input.transactionType === "string"
    ? input.transactionType.trim().toUpperCase()
    : "";

  if (!Number.isInteger(page) || page < 1) throw badRequest("Page must be a positive integer.");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw badRequest("Limit must be an integer between 1 and 100.");
  }
  if (operation && !OPERATIONS.has(operation)) {
    throw badRequest("Operation must be ADD or SUBTRACT.");
  }
  if (transactionType && !TRANSACTION_TYPES.has(transactionType)) {
    throw badRequest("Transaction type is not supported.");
  }

  const fromDate = input.from ? parseDate(input.from, "from") : null;
  const toDate = input.to ? parseDate(input.to, "to") : null;
  if (fromDate && toDate && fromDate > toDate) {
    throw badRequest("from must be on or before to.");
  }
  if (fromDate && toDate) {
    const rangeDays = Math.round((toDate - fromDate) / 86400000) + 1;
    if (rangeDays > MAX_RANGE_DAYS) {
      throw badRequest(`Date range must not exceed ${MAX_RANGE_DAYS} days.`);
    }
  }

  return AnalyticsRepository.getDashboardTransactionLog({
    page,
    limit,
    operation: operation || undefined,
    transactionType: transactionType || undefined,
    from: fromDate ? `${toDateKey(fromDate)}T00:00:00.000Z` : undefined,
    toExclusive: toDate ? addUtcDays(toDate, 1).toISOString() : undefined,
  }, accessToken);
};
