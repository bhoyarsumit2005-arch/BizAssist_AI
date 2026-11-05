import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  IndianRupee,
  Package,
  Plus,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users
} from "lucide-react";

import StatCard from "../components/StatCard";
import EmptyState from "../components/EmptyState";
import { AreaChart } from "../components/Charts";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import {
  averageOrderValue,
  buildOrderCountSeries,
  buildRevenueSeries,
  getOrdersInRange,
  getStatusBreakdown,
  percentChange,
  sumRevenue
} from "../utils/metrics";
import { formatCurrency, formatDate, formatNumber, getStatusMeta, shortId, timeAgo } from "../utils/format";

const DAY = 86400000;

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

export default function Dashboard() {
  const { user, business } = useAuth();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState("");
  const [metric, setMetric] = useState("revenue");

  const load = useCallback(async () => {
    setLoading(true);
    setWarning("");

    const results = await Promise.allSettled([
      api.get("/products"),
      api.get("/orders"),
      api.get("/customers")
    ]);

    const unauthorized = results.some(
      (result) => result.status === "rejected" && result.reason?.response?.status === 401
    );
    if (unauthorized) return;

    const [productResult, orderResult, customerResult] = results;
    const anySuccess = results.some((result) => result.status === "fulfilled");

    if (!anySuccess) {
      setProducts([]);
      setOrders([]);
      setCustomers([]);
      setWarning("Could not load your store data. Check that the API is running and try again.");
      setLoading(false);
      return;
    }

    const failedCount = results.filter((result) => result.status === "rejected").length;
    if (failedCount) {
      setWarning("Some live data could not be loaded. Showing what is available.");
    }

    setProducts(productResult.status === "fulfilled" ? productResult.value.data.products || [] : []);
    setOrders(orderResult.status === "fulfilled" ? orderResult.value.data.orders || [] : []);
    setCustomers(customerResult.status === "fulfilled" ? customerResult.value.data.customers || [] : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const view = useMemo(() => {
    const now = Date.now();
    const recentOrders = orders.filter((order) => now - new Date(order.createdAt).getTime() <= 30 * DAY);
    const previousOrders = orders.filter((order) => {
      const time = new Date(order.createdAt).getTime();
      return time <= now - 30 * DAY && time > now - 60 * DAY;
    });

    const revenue = sumRevenue(recentOrders);
    const previousRevenue = sumRevenue(previousOrders);
    const lowStock = products
      .filter((product) => product.isActive !== false && Number(product.stock) <= 10)
      .sort((a, b) => Number(a.stock) - Number(b.stock));
    const pending = orders.filter((order) => order.status === "pending").length;
    const newCustomers = customers.filter(
      (customer) => now - new Date(customer.createdAt).getTime() <= 7 * DAY
    ).length;

    const recent = [...orders]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    const insights = [];
    if (pending) insights.push(`${pending} order${pending === 1 ? "" : "s"} waiting for confirmation.`);
    if (lowStock.length) {
      insights.push(
        `${lowStock.length} product${lowStock.length === 1 ? " is" : "s are"} low on stock${
          lowStock[0]?.name ? ` — start with ${lowStock[0].name}.` : "."
        }`
      );
    }
    if (newCustomers) insights.push(`${newCustomers} new customer${newCustomers === 1 ? "" : "s"} joined this week.`);
    if (!insights.length) insights.push("Everything is on track. Your store is running smoothly.");

    return {
      revenue,
      revenueChange: previousRevenue ? percentChange(revenue, previousRevenue) : null,
      ordersChange: previousOrders.length ? percentChange(recentOrders.length, previousOrders.length) : null,
      lowStock,
      pending,
      newCustomers,
      recent,
      insights,
      statusBreakdown: getStatusBreakdown(orders)
    };
  }, [orders, products, customers]);

  const revenueSeries = useMemo(() => buildRevenueSeries(orders, 30), [orders]);
  const orderSeries = useMemo(() => buildOrderCountSeries(orders, 30), [orders]);
  const sparkRevenue = useMemo(() => revenueSeries.slice(-14), [revenueSeries]);
  const sparkOrders = useMemo(() => orderSeries.slice(-14), [orderSeries]);

  const activeCustomers = customers.filter((customer) => customer.isActive !== false).length;
  const activeProducts = products.filter((product) => product.isActive !== false).length;
  const first = user?.name?.split(" ")[0] || "there";

  return (
    <div className="page dashboard-page">
      <header className="page-head">
        <div>
          <div className="page-head__eyebrow">
            <span>{greeting()}, {first}</span>
          </div>
          <h2>Here&apos;s how {business?.name || "your business"} is doing.</h2>
          <p>Orders, paid revenue, and customer activity from the last 30 days.</p>
        </div>
        <div className="page-head__actions">
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh
          </button>
          <Link to="/products?new=1" className="btn btn-primary">
            <Plus size={17} /> Add product
          </Link>
        </div>
      </header>

      {warning ? (
        <div className="notice notice--warning">
          <AlertTriangle size={17} />
          <p>{warning}</p>
        </div>
      ) : null}

      <section className="stat-grid" aria-label="Key metrics">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div className="stat-card stat-card--skeleton" key={index}>
              <span className="skeleton skeleton--icon" />
              <span className="skeleton skeleton--label" />
              <span className="skeleton skeleton--value" />
              <span className="skeleton skeleton--hint" />
            </div>
          ))
        ) : (
          <>
            <StatCard
              icon={IndianRupee}
              label="Paid revenue"
              value={formatCurrency(view.revenue)}
              change={view.revenueChange}
              hint="Last 30 days · paid orders only"
              tone="emerald"
              sparkline={sparkRevenue}
            />
            <StatCard
              icon={ShoppingCart}
              label="Orders"
              value={formatNumber(getOrdersInRange(orders, 30).length)}
              change={view.ordersChange}
              hint={`${view.pending} pending confirmation`}
              tone="blue"
              sparkline={sparkOrders}
            />
            <StatCard
              icon={Users}
              label="Customers"
              value={formatNumber(customers.length)}
              hint={`${activeCustomers} active · ${view.newCustomers} new this week`}
              tone="violet"
            />
            <StatCard
              icon={Package}
              label="Products"
              value={formatNumber(products.length)}
              hint={`${activeProducts} active · ${view.lowStock.length} low on stock`}
              tone="amber"
            />
          </>
        )}
      </section>

      <section className="dashboard-grid">
        <article className="card chart-card">
          <div className="card__head">
            <div>
              <span className="section-eyebrow">
                <CalendarDays size={14} /> Last 30 days
              </span>
              <h3>Store performance</h3>
            </div>
            <div className="segmented">
              <button
                type="button"
                className={metric === "revenue" ? "is-active" : ""}
                onClick={() => setMetric("revenue")}
              >
                Paid revenue
              </button>              <button
                type="button"
                className={metric === "orders" ? "is-active" : ""}
                onClick={() => setMetric("orders")}
              >
                Orders
              </button>
            </div>
          </div>
          <div className="chart-summary">
            <strong>
              {metric === "revenue"
                ? formatCurrency(sumRevenue(getOrdersInRange(orders, 30)))
                : formatNumber(getOrdersInRange(orders, 30).length)}
            </strong>
            <span>
              {metric === "revenue" ? "in paid revenue" : "orders placed"} ·{" "}
              <em className="positive-note">
                <TrendingUp size={12} /> live from your store
              </em>
            </span>
          </div>
          {loading ? (
            <div className="skeleton skeleton--chart" />
          ) : metric === "revenue" ? (
            <AreaChart data={revenueSeries} color="#7c3aed" label="Paid revenue" height={252} />
          ) : (
            <AreaChart
              data={orderSeries}
              color="#c4f000"
              label="Orders"
              height={252}
              formatValue={(value) => `${formatNumber(value)} orders`}
              compactFormat={(value) => formatNumber(Math.round(value))}
            />
          )}
        </article>

        <aside className="ai-panel">
          <div className="ai-panel__glow" aria-hidden="true" />
          <div className="ai-panel__head">
            <span className="ai-orb">
              <Sparkles size={18} />
            </span>
            <span className="chip chip--on-dark">AI assistant</span>
          </div>
          <h3>What needs your attention</h3>
          <p className="ai-panel__lede">
            A quick read on your store, generated from today&apos;s orders and inventory.
          </p>
          <ul className="ai-insights">
            {view.insights.map((insight) => (
              <li key={insight}>
                <span className="ai-insights__dot" />
                {insight}
              </li>
            ))}
          </ul>
          <div className="ai-panel__actions">
            <Link to="/conversations" className="btn btn-light">
              Open inbox <ArrowUpRight size={15} />
            </Link>
            <Link to="/analytics" className="ai-panel__link">
              View analytics <ArrowRight size={14} />
            </Link>
          </div>
          <div className="ai-panel__footer">
            <Link to="/settings/ai" className="ai-panel__link">
              Configure auto-replies in Settings <ArrowRight size={14} />
            </Link>
          </div>
        </aside>
      </section>

      <section className="dashboard-bottom">
        <article className="card table-card">
          <div className="card__head">
            <div>
              <h3>Recent orders</h3>
              <p>Your five most recent orders.</p>
            </div>
            <Link to="/orders" className="link-btn">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="skeleton-list">
              {Array.from({ length: 4 }).map((_, index) => (
                <div className="skeleton skeleton--row" key={index} />
              ))}
            </div>
          ) : view.recent.length ? (
            <div className="table-wrap">
              <table className="data-table data-table--compact">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {view.recent.map((order) => {
                    const meta = getStatusMeta(order.status);
                    const customer = order.customerId;
                    return (
                      <tr key={order._id}>
                        <td>
                          <span className="order-id">#{shortId(order._id)}</span>
                        </td>
                        <td>
                          <div className="table-person">
                            <span className="avatar avatar--xs">
                              {(customer?.name || "Guest").slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                              <strong>{customer?.name || "Guest customer"}</strong>
                              <span>{(order.items || []).length} item{(order.items || []).length === 1 ? "" : "s"}</span>
                            </div>
                          </div>
                        </td>
                        <td className="table-amount">{formatCurrency(order.totalAmount)}</td>
                        <td>
                          <span className={`chip chip--${meta.tone}`}>{meta.label}</span>
                        </td>
                        <td className="muted">{formatDate(order.createdAt, { year: undefined, hour: "numeric", minute: "2-digit" })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              compact
              icon={ShoppingCart}
              title="No orders yet"
              description="Orders will appear here as soon as your assistant captures one."
              action={
                <Link to="/conversations" className="btn btn-secondary btn-sm">
                  Open conversations
                </Link>
              }
            />
          )}
        </article>

        <article className="card stock-card">
          <div className="card__head">
            <div>
              <h3>Inventory watch</h3>
              <p>Products that need a restock soon.</p>
            </div>
            <Link to="/products" className="link-btn">
              All products <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="skeleton-list">
              {Array.from({ length: 3 }).map((_, index) => (
                <div className="skeleton skeleton--row" key={index} />
              ))}
            </div>
          ) : view.lowStock.length ? (
            <ul className="stock-list">
              {view.lowStock.slice(0, 4).map((product) => (
                <li key={product._id}>
                  <span className={`stock-thumb ${Number(product.stock) === 0 ? "is-empty" : ""}`}>
                    {product.name?.slice(0, 1).toUpperCase() || "P"}
                  </span>
                  <div>
                    <strong>{product.name}</strong>
                    <span>{formatCurrency(product.price)} · per {product.unit || "piece"}</span>
                  </div>
                  <span className={`chip chip--${Number(product.stock) === 0 ? "danger" : "warning"}`}>
                    {Number(product.stock) === 0 ? "Out" : `${product.stock} left`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={Package} title="Stock looks healthy" description="Nothing needs restocking right now." />
          )}

          <div className="stock-card__footer">
            <div>
              <span>Pending orders</span>
              <strong>{view.pending}</strong>
            </div>
            <div>
              <span>Low stock alerts</span>
              <strong>{view.lowStock.length}</strong>
            </div>
            <Link to="/products?new=1" className="icon-btn" aria-label="Add a product">
              <Plus size={17} />
            </Link>
          </div>
        </article>
      </section>

      <section className="mini-metrics">
        <div className="mini-metric">
          <span className="mini-metric__icon mini-metric__icon--emerald"><IndianRupee size={16} /></span>
          <div>
            <span>Avg. paid order</span>
            <strong>{formatCurrency(averageOrderValue(orders))}</strong>
          </div>
        </div>
        <div className="mini-metric">
          <span className="mini-metric__icon mini-metric__icon--blue"><ShoppingCart size={16} /></span>
          <div>
            <span>Delivered orders</span>
            <strong>{formatNumber(view.statusBreakdown.find((item) => item.status === "delivered")?.count || 0)}</strong>
          </div>
        </div>
        <div className="mini-metric">
          <span className="mini-metric__icon mini-metric__icon--violet"><Sparkles size={16} /></span>
          <div>
            <span>Latest activity</span>
            <strong>{view.recent[0] ? timeAgo(view.recent[0].createdAt) : "No activity yet"}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
