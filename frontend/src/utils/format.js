const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const compactFormatter = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1
});

export const formatCurrency = (value) => currencyFormatter.format(Number(value) || 0);

export const formatCompactCurrency = (value) => `₹${compactFormatter.format(Number(value) || 0)}`;

export const formatNumber = (value) => new Intl.NumberFormat("en-IN").format(Number(value) || 0);

export const formatDate = (value, options = {}) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options
  }).format(date);
};

export const formatTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
};

export const timeAgo = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return formatDate(date, { year: undefined });
};

export const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";

export const shortId = (id = "") => {
  const value = String(id);
  return value.length > 6 ? value.slice(-6).toUpperCase() : value.toUpperCase();
};

export const isSameDay = (a, b) => {
  const first = new Date(a);
  const second = new Date(b);
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
};

export const orderStatuses = [
  { value: "pending", label: "Pending", tone: "warning" },
  { value: "confirmed", label: "Confirmed", tone: "info" },
  { value: "processing", label: "Processing", tone: "violet" },
  { value: "dispatched", label: "Dispatched", tone: "cyan" },
  { value: "delivered", label: "Delivered", tone: "success" },
  { value: "cancelled", label: "Cancelled", tone: "danger" }
];

export const paymentStatuses = {
  unpaid: { label: "Unpaid", tone: "danger" },
  pending: { label: "Payment pending", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
  refunded: { label: "Refunded", tone: "neutral" }
};

export const getStatusMeta = (status) =>
  orderStatuses.find((item) => item.value === status) || {
    value: status,
    label: status,
    tone: "neutral"
  };

export const toCsv = (rows, columns) => {
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  const header = columns.map((column) => escape(column.label)).join(",");
  const body = rows.map((row) => columns.map((column) => escape(column.value(row))).join(","));

  return [header, ...body].join("\n");
};

export const downloadCsv = (filename, csv) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
