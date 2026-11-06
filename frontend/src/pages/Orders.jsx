import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  Eye,
  Loader2,
  PackageCheck,
  Phone,
  RefreshCw,
  Search,
  ShoppingBag,
  Truck,
  XCircle
} from "lucide-react";

import EmptyState from "../components/EmptyState";
import Modal from "../components/Modal";
import { useToast } from "../context/ToastContext";
import api, { getErrorMessage } from "../services/api";
import {
  averageOrderValue,
  getStatusBreakdown,
  isPaid,
  sumRevenue
} from "../utils/metrics";
import {
  downloadCsv,
  formatCurrency,
  formatDate,
  formatTime,
  getStatusMeta,
  getStatusOptions,
  initials,
  orderStatuses,
  paymentStatuses,
  shortId,
  timeAgo,
  toCsv
} from "../utils/format";

const PAGE_SIZE = 8;
const workflow = ["pending", "confirmed", "processing", "dispatched", "delivered"];

const paymentMethods = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "other", label: "Other" }
];

const tabs = [{ value: "all", label: "All orders" }, ...orderStatuses];

export default function Orders() {
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/orders");
      setOrders(data.orders || []);
    } catch (error) {
      if (error?.response?.status === 401) return;
      setOrders([]);
      toast(getErrorMessage(error, "Could not load orders."), "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  const counts = useMemo(() => {
    const map = { all: orders.length };
    orderStatuses.forEach((item) => {
      map[item.value] = orders.filter((order) => order.status === item.value).length;
    });
    return map;
  }, [orders]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return orders
      .filter((order) => {
        if (status !== "all" && order.status !== status) return false;
        if (!term) return true;

        const customer = order.customerId;
        const haystack = [
          order._id,
          customer?.name,
          customer?.phone,
          ...(order.items || []).map((item) => item.name)
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(term);
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders, search, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rangeStart = filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(page * PAGE_SIZE, filtered.length);

  const stats = useMemo(() => {
    const delivered = orders.filter((order) => order.status === "delivered").length;
    const pending = orders.filter((order) => ["pending", "confirmed"].includes(order.status)).length;
    return {
      revenue: sumRevenue(orders),
      average: averageOrderValue(orders),
      paidCount: orders.filter(isPaid).length,
      delivered,
      pending,
      breakdown: getStatusBreakdown(orders)
    };
  }, [orders]);

  const handleStatusChange = async (order, nextStatus) => {
    if (order.status === nextStatus) return;
    const previous = orders;
    setUpdatingId(order._id);

    setOrders((current) =>
      current.map((item) => (item._id === order._id ? { ...item, status: nextStatus } : item))
    );
    setSelected((current) =>
      current && current._id === order._id ? { ...current, status: nextStatus } : current
    );

    try {
      const { data } = await api.put(`/orders/${order._id}/status`, { status: nextStatus });
      if (data.order) {
        setOrders((current) => current.map((item) => (item._id === order._id ? data.order : item)));
        setSelected((current) => (current && current._id === order._id ? data.order : current));
      }
      toast(`Order #${shortId(order._id)} marked ${getStatusMeta(nextStatus).label.toLowerCase()}.`);
    } catch (error) {
      setOrders(previous);
      toast(getErrorMessage(error, "Could not update the order status."), "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRecordPayment = async (order, method) => {
    setPaying(true);

    try {
      const { data } = await api.post(`/orders/${order._id}/payment`, { method });
      if (data.order) {
        setOrders((current) => current.map((item) => (item._id === order._id ? data.order : item)));
        setSelected(data.order);
      }
      toast(`Payment recorded for order #${shortId(order._id)}.`);
    } catch (error) {
      toast(getErrorMessage(error, "Could not record the payment."), "error");
    } finally {
      setPaying(false);
    }
  };

  const exportOrders = () => {
    if (!filtered.length) {
      toast("There are no orders to export.", "info");
      return;
    }

    const csv = toCsv(filtered, [
      { label: "Order", value: (order) => `#${shortId(order._id)}` },
      { label: "Customer", value: (order) => order.customerId?.name || "Guest" },
      { label: "Phone", value: (order) => order.customerId?.phone || "" },
      { label: "Items", value: (order) => (order.items || []).map((item) => `${item.quantity}× ${item.name}`).join("; ") },
      { label: "Total", value: (order) => order.totalAmount },
      { label: "Status", value: (order) => getStatusMeta(order.status).label },
      { label: "Payment", value: (order) => paymentStatuses[order.paymentStatus]?.label || order.paymentStatus },
      { label: "Placed", value: (order) => formatDate(order.createdAt) }
    ]);

    downloadCsv(`bizassist-orders-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast(`Exported ${filtered.length} orders.`);
  };

  return (
    <div className="page orders-page">
      <header className="page-head">
        <div>
          <div className="page-head__eyebrow">
            <span>Fulfilment</span>
          </div>
          <h2>Orders</h2>
          <p>Track every order from first message to delivery.</p>
        </div>
        <div className="page-head__actions">
          <button type="button" className="btn btn-secondary" onClick={exportOrders}>
            <Download size={16} /> Export
          </button>
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh
          </button>
        </div>
      </header>

      <section className="order-stats" aria-label="Order summary">
        <div className="order-stat">
          <span>Paid revenue</span>
          <strong>{formatCurrency(stats.revenue)}</strong>
          <em>From {stats.paidCount} paid order{stats.paidCount === 1 ? "" : "s"}</em>
        </div>
        <div className="order-stat">
          <span>Average paid order</span>
          <strong>{formatCurrency(stats.average)}</strong>
          <em>Paid orders only</em>
        </div>
        <div className="order-stat">
          <span>Needs action</span>
          <strong>{stats.pending}</strong>
          <em>Pending or confirmed</em>
        </div>
        <div className="order-stat">
          <span>Delivered</span>
          <strong>{stats.delivered}</strong>
          <em>{orders.length ? Math.round((stats.delivered / orders.length) * 100) : 0}% of all orders</em>
        </div>
      </section>

      <section className="card orders-card">
        <div className="toolbar toolbar--sticky">
          <div className="search-box">
            <Search size={17} />
            <input
              type="search"
              placeholder="Search order, customer, or product…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search orders"
            />
          </div>
          <span className="toolbar__hint">
            <ArrowUpDown size={14} /> Newest first
          </span>
        </div>

        <div className="tabs tabs--scroll" role="tablist" aria-label="Filter by status">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={status === tab.value}
              className={status === tab.value ? "is-active" : ""}
              onClick={() => setStatus(tab.value)}
            >
              {tab.label}
              <span>{counts[tab.value] ?? 0}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="skeleton-list skeleton-list--padded">
            {Array.from({ length: 6 }).map((_, index) => (
              <div className="skeleton skeleton--row" key={index} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title={orders.length ? "No orders match this view" : "No orders yet"}
            description={
              orders.length
                ? "Try clearing the search or choosing another status."
                : "When your assistant captures an order, it will show up here ready to fulfil."
            }
            action={
              orders.length ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setSearch("");
                    setStatus("all");
                  }}
                >
                  Clear filters
                </button>
              ) : (
                <Link to="/conversations" className="btn btn-primary">
                  Open conversations
                </Link>
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table orders-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Placed</th>
                  <th><span className="sr-only">View</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((order) => {
                  const customer = order.customerId;
                  const meta = getStatusMeta(order.status);
                  const statusOptions = getStatusOptions(order.status);
                  const payment = paymentStatuses[order.paymentStatus] || { label: order.paymentStatus, tone: "neutral" };
                  const itemCount = (order.items || []).reduce((total, item) => total + (Number(item.quantity) || 0), 0);

                  return (
                    <tr key={order._id} onClick={() => setSelected(order)} className="is-clickable">
                      <td>
                        <span className="order-id">#{shortId(order._id)}</span>
                        <span className="order-time">{formatTime(order.createdAt)}</span>
                      </td>
                      <td>
                        <div className="table-person">
                          <span className="avatar avatar--xs">{initials(customer?.name || "Guest")}</span>
                          <div>
                            <strong>{customer?.name || "Guest customer"}</strong>
                            <span>{customer?.phone || "No phone"}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="order-items">
                          {itemCount} item{itemCount === 1 ? "" : "s"}
                          <em>{order.items?.[0]?.name || "—"}</em>
                        </span>
                      </td>
                      <td className="table-amount">{formatCurrency(order.totalAmount)}</td>
                      <td>
                        <span className={`chip chip--${payment.tone}`}>{payment.label}</span>
                      </td>
                      <td onClick={(event) => event.stopPropagation()}>
                        <div className={`status-select status-select--${meta.tone}`}>
                          {updatingId === order._id ? (
                            <Loader2 size={14} className="spin" />
                          ) : (
                            <span className="status-select__dot" />
                          )}
                          <select
                            value={order.status}
                            onChange={(event) => handleStatusChange(order, event.target.value)}
                            disabled={updatingId === order._id || statusOptions.length <= 1}
                            aria-label={`Status for order ${shortId(order._id)}`}
                          >
                            {statusOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="muted">
                        {formatDate(order.createdAt)}
                        <span className="order-time">{timeAgo(order.createdAt)}</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelected(order);
                          }}
                          aria-label={`View order ${shortId(order._id)}`}
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length ? (
          <footer className="table-footer">
            <span>
              Showing {rangeStart}–{rangeEnd} of {filtered.length} orders
            </span>
            <div className="pagination">
              <button
                type="button"
                className="icon-btn"
                onClick={() => setPage((value) => Math.max(value - 1, 1))}
                disabled={page === 1}
                aria-label="Previous page"
              >
                <ArrowLeft size={16} />
              </button>
              <span>Page {page} of {pageCount}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setPage((value) => Math.min(value + 1, pageCount))}
                disabled={page === pageCount}
                aria-label="Next page"
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </footer>
        ) : null}
      </section>

      <OrderDetails
        order={selected}
        onClose={() => setSelected(null)}
        onStatusChange={handleStatusChange}
        onRecordPayment={handleRecordPayment}
        updating={updatingId === selected?._id}
        paying={paying}
      />
    </div>
  );
}

function OrderDetails({ order, onClose, onStatusChange, onRecordPayment, updating, paying }) {
  const [method, setMethod] = useState("cash");

  if (!order) return null;

  const meta = getStatusMeta(order.status);
  const statusOptions = getStatusOptions(order.status);
  const payment = paymentStatuses[order.paymentStatus] || { label: order.paymentStatus, tone: "neutral" };
  const currentIndex = workflow.indexOf(order.status);
  const itemTotal = (order.items || []).reduce(
    (total, item) => total + (Number(item.price) || 0) * (Number(item.quantity) || 0),
    0
  );

  return (
    <Modal
      open={Boolean(order)}
      onClose={onClose}
      title={`Order #${shortId(order._id)}`}
      subtitle={`Placed ${formatDate(order.createdAt)} at ${formatTime(order.createdAt)}`}
      size="lg"
      footer={
        <>
          <a className="btn btn-secondary" href={`tel:${order.customerId?.phone || ""}`}>
            <Phone size={16} /> Call customer
          </a>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <div className="order-detail">
        <div className="order-detail__top">
          <div className="order-customer">
            <span className="avatar avatar--lg">{initials(order.customerId?.name || "Guest")}</span>
            <div>
              <strong>{order.customerId?.name || "Guest customer"}</strong>
              <span>{order.customerId?.phone || "No phone on file"}</span>
            </div>
          </div>
          <div className="order-detail__chips">
            <span className={`chip chip--${meta.tone}`}>{meta.label}</span>
            <span className={`chip chip--${payment.tone}`}>{payment.label}</span>
          </div>
        </div>

        {order.status === "cancelled" ? (
          <div className="notice notice--danger">
            <XCircle size={17} />
            <p>This order was cancelled. No further fulfilment steps are required.</p>
          </div>
        ) : (
          <ol className="order-timeline">
            {workflow.map((step, index) => {
              const stepMeta = getStatusMeta(step);
              const done = currentIndex >= index;
              return (
                <li key={step} className={done ? "is-done" : ""}>
                  <span className="order-timeline__dot">
                    {step === "delivered" ? <PackageCheck size={13} /> : step === "dispatched" ? <Truck size={13} /> : step === "pending" ? <Clock size={13} /> : <CheckCircle2 size={13} />}
                  </span>
                  <span>{stepMeta.label}</span>
                </li>
              );
            })}
          </ol>
        )}

        <div className="order-detail__grid">
          <div className="order-items-card">
            <h3>Items</h3>
            <ul>
              {(order.items || []).map((item, index) => (
                <li key={`${item.name}-${index}`}>
                  <span className="item-qty">{item.quantity}×</span>
                  <div>
                    <strong>{item.name || "Item"}</strong>
                    <span>{formatCurrency(item.price)} each</span>
                  </div>
                  <strong>{formatCurrency((Number(item.price) || 0) * (Number(item.quantity) || 0))}</strong>
                </li>
              ))}
            </ul>
            <div className="order-total">
              <div><span>Subtotal</span><strong>{formatCurrency(itemTotal)}</strong></div>
              <div><span>Delivery</span><strong className="text-success">Free</strong></div>
              <div className="order-total__grand"><span>Total</span><strong>{formatCurrency(order.totalAmount)}</strong></div>
            </div>
          </div>

          <aside className="order-side">
            <div className="order-side__block">
              <span className="order-side__label">Update status</span>
              <div className={`status-select status-select--${meta.tone} status-select--wide`}>
                {updating ? <Loader2 size={14} className="spin" /> : <span className="status-select__dot" />}
                <select
                  value={order.status}
                  onChange={(event) => onStatusChange(order, event.target.value)}
                  disabled={updating || statusOptions.length <= 1}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="order-side__block">
              <span className="order-side__label">Payment</span>
              <div className="order-side__row">
                <CreditCard size={16} />
                <span>{payment.label}</span>
              </div>
              {order.status !== "cancelled" && order.paymentStatus !== "paid" ? (
                <div className="payment-form">
                  <div className="select-wrap select-wrap--compact">
                    <select
                      value={method}
                      onChange={(event) => setMethod(event.target.value)}
                      aria-label="Payment method"
                    >
                      {paymentMethods.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => onRecordPayment(order, method)}
                    disabled={paying}
                  >
                    {paying ? <Loader2 size={14} className="spin" /> : <CreditCard size={14} />}
                    {paying ? "Recording…" : "Record full payment"}
                  </button>
                </div>
              ) : null}
            </div>

            <Link to="/conversations" className="order-side__link">
              Open inbox <ChevronRight size={14} />
            </Link>
          </aside>
        </div>

        {order.status === "pending" ? (
          <div className="notice notice--info">
            <AlertTriangle size={17} />
            <p>Confirm this order to let the customer know it is being prepared.</p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
