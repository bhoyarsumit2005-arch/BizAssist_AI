import { getStatusMeta } from "./format";

export const isCancelled = (order) => order?.status === "cancelled";

export const sumRevenue = (orders = []) =>
  orders.reduce((total, order) => (isCancelled(order) ? total : total + (Number(order.totalAmount) || 0)), 0);

export const averageOrderValue = (orders = []) => {
  const valid = orders.filter((order) => !isCancelled(order));
  if (!valid.length) return 0;
  return sumRevenue(valid) / valid.length;
};

export const buildRevenueSeries = (orders = [], days = 30) => {
  const buckets = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - index);
    buckets.push({
      date,
      label: new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: days > 14 ? "short" : undefined
      }).format(date),
      fullLabel: new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        weekday: "short"
      }).format(date),
      value: 0,
      orders: 0
    });
  }

  const first = buckets[0]?.date.getTime() || 0;

  orders.forEach((order) => {
    if (isCancelled(order)) return;
    const created = new Date(order.createdAt);
    if (Number.isNaN(created.getTime())) return;

    created.setHours(0, 0, 0, 0);
    const diff = Math.round((created.getTime() - first) / 86400000);

    if (diff >= 0 && diff < buckets.length) {
      buckets[diff].value += Number(order.totalAmount) || 0;
      buckets[diff].orders += 1;
    }
  });

  return buckets;
};

export const buildOrderCountSeries = (orders = [], days = 30) => {
  const buckets = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - index);
    buckets.push({
      date,
      label: new Intl.DateTimeFormat("en-IN", { day: "numeric", month: days > 14 ? "short" : undefined }).format(date),
      value: 0
    });
  }

  const first = buckets[0]?.date.getTime() || 0;

  orders.forEach((order) => {
    const created = new Date(order.createdAt);
    if (Number.isNaN(created.getTime())) return;
    created.setHours(0, 0, 0, 0);
    const diff = Math.round((created.getTime() - first) / 86400000);
    if (diff >= 0 && diff < buckets.length) buckets[diff].value += 1;
  });

  return buckets;
};

export const getOrdersInRange = (orders = [], days = 30) => {
  const cutoff = Date.now() - days * 86400000;
  return orders.filter((order) => {
    const created = new Date(order.createdAt).getTime();
    return !Number.isNaN(created) && created >= cutoff;
  });
};

export const getStatusBreakdown = (orders = []) => {
  const counts = orders.reduce((map, order) => {
    const key = order.status || "pending";
    map[key] = (map[key] || 0) + 1;
    return map;
  }, {});

  return Object.entries(counts)
    .map(([status, count]) => {
      const meta = getStatusMeta(status);
      return { status, label: meta.label, tone: meta.tone, count };
    })
    .sort((a, b) => b.count - a.count);
};

export const getTopProducts = (orders = [], limit = 5) => {
  const map = new Map();

  orders.forEach((order) => {
    if (isCancelled(order)) return;
    (order.items || []).forEach((item) => {
      const key = item.name || "Unnamed item";
      const current = map.get(key) || { name: key, quantity: 0, revenue: 0 };
      current.quantity += Number(item.quantity) || 0;
      current.revenue += (Number(item.quantity) || 0) * (Number(item.price) || 0);
      map.set(key, current);
    });
  });

  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
};

export const getCustomerStats = (orders = []) => {
  const map = new Map();

  orders.forEach((order) => {
    const customer = order.customerId;
    const id = typeof customer === "string" ? customer : customer?._id;
    if (!id) return;

    const current = map.get(id) || { orders: 0, spent: 0, lastOrderAt: null, name: customer?.name, phone: customer?.phone };
    current.orders += 1;
    if (!isCancelled(order)) current.spent += Number(order.totalAmount) || 0;
    const created = order.createdAt;
    if (!current.lastOrderAt || new Date(created) > new Date(current.lastOrderAt)) current.lastOrderAt = created;
    map.set(id, current);
  });

  return map;
};

export const percentChange = (current, previous) => {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};
