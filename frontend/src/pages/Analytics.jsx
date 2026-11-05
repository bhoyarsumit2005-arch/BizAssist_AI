import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  BarChart3,
  CreditCard,
  Download,
  IndianRupee,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  UserPlus,
  Wallet
} from "lucide-react";

import EmptyState from "../components/EmptyState";
import { AreaChart, BarList, DonutChart } from "../components/Charts";
import { useToast } from "../context/ToastContext";
import api from "../services/api";
import {
  averageOrderValue,
  buildRevenueSeries,
  getOrdersInRange,
  getStatusBreakdown,
  getTopProducts,
  isPaid,
  percentChange,
  sumRevenue
} from "../utils/metrics";
import { downloadCsv, formatCompactCurrency, formatCurrency, formatDate, formatNumber, toCsv } from "../utils/format";

const DAY = 86400000;

const ranges = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" }
];

const statusColors = {
  pending: "#f59e0b",
  confirmed: "#3b82f6",
  processing: "#7c3aed",
  dispatched: "#0891b2",
  delivered: "#5c7000",
  cancelled: "#f43f5e"
};

const paymentColors = {
  paid: "#5c7000",
  pending: "#f59e0b",
  unpaid: "#f43f5e",
  refunded: "#71717a"
};

const buildCustomerSeries = (customers, days) => {
  const buckets = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - index);
    buckets.push({
      date,
      label: new Intl.DateTimeFormat("en-IN", { day: "numeric", month: days > 14 ? "short" : undefined }).format(date),
      fullLabel: new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", weekday: "short" }).format(date),
      value: 0
    });
  }

  const first = buckets[0]?.date.getTime() || 0;
  const base = customers.filter((customer) => new Date(customer.createdAt).getTime() < first).length;
  let running = base;

  buckets.forEach((bucket) => {
    running += customers.filter((customer) => {
      const created = new Date(customer.createdAt);
      created.setHours(0, 0, 0, 0);
      return created.getTime() === bucket.date.getTime();
    }).length;
    bucket.value = running;
  });

  return buckets;
};

export default function Analytics() {
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([api.get("/orders"), api.get("/customers")]);
    const unauthorized = results.some(
      (result) => result.status === "rejected" && result.reason?.response?.status === 401
    );
    if (unauthorized) return;

    setOrders(results[0].status === "fulfilled" ? results[0].value.data.orders || [] : []);
    setCustomers(results[1].status === "fulfilled" ? results[1].value.data.customers || [] : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const view = useMemo(() => {
    const now = Date.now();
    const current = getOrdersInRange(orders, range);
    const previous = orders.filter((order) => {
      const time = new Date(order.createdAt).getTime();
      return time <= now - range * DAY && time > now - range * 2 * DAY;
    });

    const revenue = sumRevenue(current);
    const prevRevenue = sumRevenue(previous);
    const newCustomers = customers.filter(
      (customer) => now - new Date(customer.createdAt).getTime() <= range * DAY
    ).length;
    const prevCustomers = customers.filter((customer) => {
      const time = new Date(customer.createdAt).getTime();
      return time <= now - range * DAY && time > now - range * 2 * DAY;
    }).length;

    const statusBreakdown = getStatusBreakdown(current);
    const paymentCounts = current.reduce((map, order) => {
      const key = order.paymentStatus || "unpaid";
      map[key] = (map[key] || 0) + 1;
      return map;
    }, {});

    const daily = [...buildRevenueSeries(current, range)].reverse().slice(0, 7);

    return {
      current,
      revenue,
      revenueChange: prevRevenue ? percentChange(revenue, prevRevenue) : null,
      ordersChange: previous.length ? percentChange(current.length, previous.length) : null,
      average: averageOrderValue(current),
      paidOrders: current.filter(isPaid).length,
      averageChange: previous.length
        ? percentChange(averageOrderValue(current), averageOrderValue(previous))
        : null,
      newCustomers,
      customersChange: prevCustomers ? percentChange(newCustomers, prevCustomers) : null,
      statusBreakdown,
      paymentSegments: Object.entries(paymentCounts)
        .map(([status, count]) => ({
          label: status === "pending" ? "Payment pending" : status.charAt(0).toUpperCase() + status.slice(1),
          value: count,
          color: paymentColors[status] || "#71717a"
        }))
        .sort((a, b) => b.value - a.value),
      topProducts: getTopProducts(current, 5),
      daily
    };
  }, [orders, customers, range]);

  const revenueSeries = useMemo(() => buildRevenueSeries(orders, range), [orders, range]);
  const customerSeries = useMemo(() => buildCustomerSeries(customers, range), [customers, range]);

  const statusSegments = view.statusBreakdown.map((item) => ({
    label: item.label,
    value: item.count,
    color: statusColors[item.status] || "#71717a"
  }));

  const exportReport = () => {
    const rows = view.daily;
    if (!rows.length) {
      toast("There is no data to export for this range.", "info");
      return;
    }

    const csv = toCsv(rows, [
      { label: "Date", value: (row) => formatDate(row.date) },
      { label: "Paid orders", value: (row) => row.orders },
      { label: "Paid revenue", value: (row) => row.value },
      { label: "Average paid order", value: (row) => (row.orders ? Math.round(row.value / row.orders) : 0) }
    ]);

    downloadCsv(`bizassist-sales-${range}d-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast("Sales report exported.");
  };

  const hasData = orders.length > 0 || customers.length > 0;

  return (
    <div className="page analytics-page">
      <header className="page-head">
        <div>
          <div className="page-head__eyebrow">
            <span>Reports</span>
          </div>
          <h2>Analytics</h2>
          <p>Understand what sells, who buys, and where your growth comes from.</p>
        </div>
        <div className="page-head__actions">
          <div className="segmented">
            {ranges.map((option) => (
              <button
                key={option.value}
                type="button"
                className={range === option.value ? "is-active" : ""}
                onClick={() => setRange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh
          </button>
          <button type="button" className="btn btn-primary" onClick={exportReport}>
            <Download size={16} /> Export report
          </button>
        </div>
      </header>

      {!loading && !hasData ? (
        <div className="card">
          <EmptyState
            icon={BarChart3}
            title="No activity to analyse yet"
            description="Your reports will come to life once your assistant captures a few conversations and orders."
            action={<Link to="/conversations" className="btn btn-primary">Open inbox</Link>}
          />
        </div>
      ) : null}

      <section className="analytics-kpis" aria-label="Sales summary">
        <article className="analytics-kpi">
          <span className="analytics-kpi__icon analytics-kpi__icon--emerald"><IndianRupee size={18} /></span>
          <span className="analytics-kpi__label">Paid revenue</span>
          <strong>{formatCurrency(view.revenue)}</strong>
          {view.revenueChange !== null ? (
            <span className={`analytics-kpi__change ${view.revenueChange >= 0 ? "is-up" : "is-down"}`}>
              <ArrowUpRight size={13} /> {Math.abs(view.revenueChange)}% vs previous {range} days
            </span>
          ) : (
            <span className="analytics-kpi__change">Last {range} days</span>
          )}
        </article>

        <article className="analytics-kpi">
          <span className="analytics-kpi__icon analytics-kpi__icon--blue"><ShoppingCart size={18} /></span>
          <span className="analytics-kpi__label">Orders</span>
          <strong>{formatNumber(view.current.length)}</strong>
          {view.ordersChange !== null ? (
            <span className={`analytics-kpi__change ${view.ordersChange >= 0 ? "is-up" : "is-down"}`}>
              <ArrowUpRight size={13} /> {Math.abs(view.ordersChange)}% vs previous period
            </span>
          ) : (
            <span className="analytics-kpi__change">Last {range} days</span>
          )}
        </article>

        <article className="analytics-kpi">
          <span className="analytics-kpi__icon analytics-kpi__icon--violet"><TrendingUp size={18} /></span>
          <span className="analytics-kpi__label">Average paid order</span>
          <strong>{formatCurrency(view.average)}</strong>
          {view.averageChange !== null ? (
            <span className={`analytics-kpi__change ${view.averageChange >= 0 ? "is-up" : "is-down"}`}>
              <ArrowUpRight size={13} /> {Math.abs(view.averageChange)}% vs previous period
            </span>
          ) : (
            <span className="analytics-kpi__change">Across {view.paidOrders} paid orders</span>
          )}
        </article>

        <article className="analytics-kpi">
          <span className="analytics-kpi__icon analytics-kpi__icon--amber"><UserPlus size={18} /></span>
          <span className="analytics-kpi__label">New customers</span>
          <strong>{formatNumber(view.newCustomers)}</strong>
          {view.customersChange !== null ? (
            <span className={`analytics-kpi__change ${view.customersChange >= 0 ? "is-up" : "is-down"}`}>
              <ArrowUpRight size={13} /> {Math.abs(view.customersChange)}% vs previous period
            </span>
          ) : (
            <span className="analytics-kpi__change">{customers.length} customers total</span>
          )}
        </article>
      </section>

      <section className="analytics-grid">
        <article className="card chart-card analytics-revenue">
          <div className="card__head">
            <div>
              <span className="section-eyebrow"><BarChart3 size={14} /> Sales report</span>
              <h3>Paid revenue over time</h3>
              <p>Daily revenue from paid orders in the last {range} days.</p>
            </div>
            <span className="chip chip--soft">{formatCompactCurrency(view.revenue)} total</span>
          </div>
          {loading ? (
            <div className="skeleton skeleton--chart" />
          ) : (
            <AreaChart data={revenueSeries} color="#7c3aed" height={280} label="Paid revenue" />
          )}
        </article>

        <article className="card donut-card">
          <div className="card__head">
            <div><h3>Orders by status</h3><p>Where orders are in fulfilment.</p></div>
          </div>
          <div className="donut-card__body">
            <DonutChart
              segments={statusSegments}
              centerLabel="orders"
              centerValue={formatNumber(view.current.length)}
            />
            <ul className="donut-legend">
              {view.statusBreakdown.map((item) => (
                <li key={item.status}>
                  <span className="donut-legend__dot" style={{ background: statusColors[item.status] || "#71717a" }} />
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </section>

      <section className="analytics-grid analytics-grid--three">
        <article className="card">
          <div className="card__head">
            <div><h3>Top products</h3><p>Ranked by paid revenue in this period.</p></div>
          </div>
          {view.topProducts.length ? (
            <BarList
              items={view.topProducts.map((product) => ({
                label: product.name,
                value: product.revenue
              }))}
              formatValue={formatCurrency}
              color="#7c3aed"
            />
          ) : (
            <EmptyState compact icon={ShoppingCart} title="No product sales yet" description="Product performance appears after your first order." />
          )}
          {view.topProducts.length ? (
            <div className="top-products-foot">
              <span>Best seller</span>
              <strong>{view.topProducts[0].name} · {view.topProducts[0].quantity} sold</strong>
            </div>
          ) : null}
        </article>

        <article className="card donut-card">
          <div className="card__head">
            <div><h3>Payment status</h3><p>How order payments currently stand.</p></div>
          </div>
          {view.paymentSegments.length ? (
            <div className="donut-card__body donut-card__body--stacked">
              <DonutChart
                segments={view.paymentSegments}
                centerLabel="payments"
                centerValue={formatNumber(view.current.length)}
                size={152}
                thickness={18}
              />
              <ul className="donut-legend">
                {view.paymentSegments.map((segment) => (
                  <li key={segment.label}>
                    <span className="donut-legend__dot" style={{ background: segment.color }} />
                    <span>{segment.label}</span>
                    <strong>{segment.value}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState compact icon={CreditCard} title="No payments yet" description="Payment data appears with your first order." />
          )}
        </article>

        <article className="card chart-card">
          <div className="card__head">
            <div><h3>Customer growth</h3><p>Cumulative customers over time.</p></div>
            <span className="chip chip--soft"><Wallet size={12} /> {customers.length} total</span>
          </div>
          {loading ? (
            <div className="skeleton skeleton--chart" />
          ) : (
            <AreaChart
              data={customerSeries}
              color="#7c3aed"
              height={210}
              label="Customers"
              formatValue={(value) => `${formatNumber(value)} customers`}
              compactFormat={(value) => formatNumber(Math.round(value))}
            />
          )}
        </article>
      </section>

      <section className="card report-card">
        <div className="card__head">
          <div><h3>Daily sales</h3><p>The last seven days of activity.</p></div>
          <span className="chip chip--soft">Auto-updated</span>
        </div>
        <div className="table-wrap">
          <table className="data-table data-table--compact">
            <thead>
              <tr><th>Date</th><th>Paid orders</th><th>Paid revenue</th><th>Average paid order</th></tr>
            </thead>
            <tbody>
              {view.daily.map((row) => (
                <tr key={row.date.toISOString()}>
                  <td>{formatDate(row.date, { weekday: "short" })}</td>
                  <td>{formatNumber(row.orders)}</td>
                  <td className="table-amount">{formatCurrency(row.value)}</td>
                  <td>{formatCurrency(row.orders ? row.value / row.orders : 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="table-footer">
          <span>Revenue counts paid, non-cancelled orders only.</span>
          <span className="muted">All amounts in INR</span>
        </footer>
      </section>
    </div>
  );
}
