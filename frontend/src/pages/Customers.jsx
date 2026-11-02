import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Download,
  Info,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  UserCheck,
  UserPlus,
  Users
} from "lucide-react";

import EmptyState from "../components/EmptyState";
import Modal from "../components/Modal";
import { useToast } from "../context/ToastContext";
import api from "../services/api";
import { demoCustomers, demoOrders } from "../services/demo";
import { getCustomerStats } from "../utils/metrics";
import {
  downloadCsv,
  formatCurrency,
  formatDate,
  initials,
  getStatusMeta,
  shortId,
  timeAgo,
  toCsv
} from "../utils/format";

const PAGE_SIZE = 9;

export default function Customers() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([api.get("/customers"), api.get("/orders")]);
    const unauthorized = results.some(
      (result) => result.status === "rejected" && result.reason?.response?.status === 401
    );
    if (unauthorized) return;

    const anySuccess = results.some((result) => result.status === "fulfilled");
    if (!anySuccess) {
      setCustomers(demoCustomers);
      setOrders(demoOrders);
      setPreview(true);
      setLoading(false);
      return;
    }

    setCustomers(results[0].status === "fulfilled" ? results[0].value.data.customers || [] : []);
    setOrders(results[1].status === "fulfilled" ? results[1].value.data.orders || [] : []);
    setPreview(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, filter, sort]);

  const orderStats = useMemo(() => getCustomerStats(orders), [orders]);

  const stats = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const active = customers.filter((customer) => customer.isActive !== false).length;
    const newThisMonth = customers.filter(
      (customer) => new Date(customer.createdAt).getTime() >= monthStart.getTime()
    ).length;
    const repeat = customers.filter((customer) => (orderStats.get(customer._id)?.orders || 0) > 1).length;
    return { active, newThisMonth, repeat };
  }, [customers, orderStats]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    const list = customers.filter((customer) => {
      if (filter === "active" && customer.isActive === false) return false;
      if (filter === "inactive" && customer.isActive !== false) return false;
      if (filter === "repeat" && (orderStats.get(customer._id)?.orders || 0) <= 1) return false;
      if (!term) return true;

      return [customer.name, customer.phone, customer.email, customer.address]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term);
    });

    return [...list].sort((a, b) => {
      const aStats = orderStats.get(a._id) || {};
      const bStats = orderStats.get(b._id) || {};

      if (sort === "name") return (a.name || "").localeCompare(b.name || "");
      if (sort === "spent") return (bStats.spent || 0) - (aStats.spent || 0);
      if (sort === "orders") return (bStats.orders || 0) - (aStats.orders || 0);
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [customers, search, filter, sort, orderStats]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCustomers = () => {
    if (!filtered.length) {
      toast("There are no customers to export.", "info");
      return;
    }

    const csv = toCsv(filtered, [
      { label: "Name", value: (customer) => customer.name },
      { label: "Phone", value: (customer) => customer.phone || "" },
      { label: "Email", value: (customer) => customer.email || "" },
      { label: "Address", value: (customer) => customer.address || "" },
      { label: "Orders", value: (customer) => orderStats.get(customer._id)?.orders || 0 },
      { label: "Spent", value: (customer) => orderStats.get(customer._id)?.spent || 0 },
      { label: "Joined", value: (customer) => formatDate(customer.createdAt) }
    ]);

    downloadCsv(`bizassist-customers-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast(`Exported ${filtered.length} customers.`);
  };

  return (
    <div className="page customers-page">
      <header className="page-head">
        <div>
          <div className="page-head__eyebrow">
            <span>Relationships</span>
            {preview ? <span className="chip chip--preview">Sample data</span> : null}
          </div>
          <h2>Customers</h2>
          <p>Everyone your business has talked to, with their history in one place.</p>
        </div>
        <div className="page-head__actions">
          <button type="button" className="btn btn-secondary" onClick={exportCustomers}>
            <Download size={16} /> Export
          </button>
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh
          </button>
        </div>
      </header>

      {preview ? (
        <div className="notice notice--preview">
          <Info size={17} />
          <p><strong>Design preview.</strong> The API is unreachable, so sample customers and orders are shown.</p>
        </div>
      ) : null}

      <section className="customer-stats" aria-label="Customer summary">
        <div className="customer-stat">
          <span className="compact-stat__icon compact-stat__icon--emerald"><Users size={17} /></span>
          <div><span>Total customers</span><strong>{customers.length}</strong></div>
        </div>
        <div className="customer-stat">
          <span className="compact-stat__icon compact-stat__icon--blue"><UserCheck size={17} /></span>
          <div><span>Active</span><strong>{stats.active}</strong></div>
        </div>
        <div className="customer-stat">
          <span className="compact-stat__icon compact-stat__icon--violet"><UserPlus size={17} /></span>
          <div><span>New this month</span><strong>{stats.newThisMonth}</strong></div>
        </div>
        <div className="customer-stat">
          <span className="compact-stat__icon compact-stat__icon--amber"><MessageCircle size={17} /></span>
          <div><span>Repeat buyers</span><strong>{stats.repeat}</strong></div>
        </div>
      </section>

      <section className="card customers-card">
        <div className="toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              type="search"
              placeholder="Search name, phone, or email…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search customers"
            />
          </div>

          <div className="toolbar__group">
            <div className="segmented">
              {[
                ["all", "All"],
                ["active", "Active"],
                ["repeat", "Repeat"],
                ["inactive", "Inactive"]
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={filter === value ? "is-active" : ""}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="select-wrap select-wrap--compact">
              <ArrowUpDown size={15} />
              <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort customers">
                <option value="newest">Newest first</option>
                <option value="name">Name A–Z</option>
                <option value="spent">Highest spend</option>
                <option value="orders">Most orders</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="skeleton-list skeleton-list--padded">
            {Array.from({ length: 6 }).map((_, index) => (
              <div className="skeleton skeleton--row" key={index} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Users}
            title={customers.length ? "No customers match this view" : "No customers yet"}
            description={
              customers.length
                ? "Try a different search or filter."
                : "Customers are added automatically when someone messages your WhatsApp number."
            }
            action={
              customers.length ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                >
                  Clear filters
                </button>
              ) : (
                <Link to="/conversations" className="btn btn-primary">Open inbox</Link>
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table customers-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Orders</th>
                  <th>Total spent</th>
                  <th>Last order</th>
                  <th>Joined</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((customer) => {
                  const customerOrders = orderStats.get(customer._id) || {};
                  return (
                    <tr key={customer._id} className="is-clickable" onClick={() => setSelected(customer)}>
                      <td>
                        <div className="table-person">
                          <span className="avatar">{initials(customer.name)}</span>
                          <div>
                            <strong>{customer.name}</strong>
                            <span>{customer.email || "No email"}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="contact-cell">
                          {customer.phone ? <><Phone size={13} /> {customer.phone}</> : <><Mail size={13} /> No phone</>}
                        </span>
                        <span className="contact-cell contact-cell--muted">
                          <MapPin size={13} /> {customer.address || "Address not added"}
                        </span>
                      </td>
                      <td>
                        <strong className="table-number">{customerOrders.orders || 0}</strong>
                      </td>
                      <td className="table-amount">{formatCurrency(customerOrders.spent || 0)}</td>
                      <td className="muted">{customerOrders.lastOrderAt ? timeAgo(customerOrders.lastOrderAt) : "—"}</td>
                      <td className="muted">{formatDate(customer.createdAt, { year: undefined })}</td>
                      <td>
                        <span className={`chip chip--${customer.isActive === false ? "neutral" : "success"}`}>
                          {customer.isActive === false ? "Inactive" : "Active"}
                        </span>
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
            <span>Showing {visible.length} of {filtered.length} customers</span>
            <div className="pagination">
              <button type="button" className="icon-btn" onClick={() => setPage((value) => Math.max(value - 1, 1))} disabled={page === 1} aria-label="Previous page">
                <ArrowLeft size={16} />
              </button>
              <span>Page {page} of {pageCount}</span>
              <button type="button" className="icon-btn" onClick={() => setPage((value) => Math.min(value + 1, pageCount))} disabled={page === pageCount} aria-label="Next page">
                <ArrowRight size={16} />
              </button>
            </div>
          </footer>
        ) : null}
      </section>

      <p className="page-footnote">
        <Info size={14} /> Customers are created automatically from WhatsApp conversations. Editing customer records
        arrives in a later step.
      </p>

      <CustomerDetails
        customer={selected}
        orders={orders.filter((order) => {
          const id = typeof order.customerId === "string" ? order.customerId : order.customerId?._id;
          return id === selected?._id;
        })}
        stats={selected ? orderStats.get(selected._id) : null}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function CustomerDetails({ customer, orders, stats, onClose }) {
  if (!customer) return null;

  const phoneDigits = (customer.phone || "").replace(/\D/g, "");

  return (
    <Modal
      open={Boolean(customer)}
      onClose={onClose}
      title="Customer profile"
      subtitle={`Customer since ${formatDate(customer.createdAt)}`}
      size="lg"
      footer={
        <>
          {phoneDigits ? (
            <a
              className="btn btn-secondary"
              href={`https://wa.me/${phoneDigits}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={16} /> WhatsApp
            </a>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
        </>
      }
    >
      <div className="customer-detail">
        <div className="customer-detail__head">
          <span className="avatar avatar--xl">{initials(customer.name)}</span>
          <div>
            <h3>{customer.name}</h3>
            <p>{customer.address || "Address not added"}</p>
            <div className="customer-detail__contact">
              {customer.phone ? <a href={`tel:${customer.phone}`}><Phone size={14} /> {customer.phone}</a> : null}
              {customer.email ? <a href={`mailto:${customer.email}`}><Mail size={14} /> {customer.email}</a> : null}
            </div>
          </div>
          <span className={`chip chip--${customer.isActive === false ? "neutral" : "success"}`}>
            {customer.isActive === false ? "Inactive" : "Active"}
          </span>
        </div>

        <div className="customer-detail__stats">
          <div><span>Orders</span><strong>{stats?.orders || 0}</strong></div>
          <div><span>Total spent</span><strong>{formatCurrency(stats?.spent || 0)}</strong></div>
          <div><span>Last order</span><strong>{stats?.lastOrderAt ? timeAgo(stats.lastOrderAt) : "—"}</strong></div>
        </div>

        <div className="customer-detail__orders">
          <div className="card__head">
            <div><h3>Recent orders</h3><p>Latest activity from this customer.</p></div>
            <Link to="/orders" className="link-btn">All orders <ArrowRight size={14} /></Link>
          </div>

          {orders.length ? (
            <ul className="customer-orders">
              {[...orders]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5)
                .map((order) => {
                  const meta = getStatusMeta(order.status);
                  return (
                    <li key={order._id}>
                      <span className="order-id">#{shortId(order._id)}</span>
                      <div>
                        <strong>{(order.items || []).map((item) => item.name).filter(Boolean).join(", ") || "Order"}</strong>
                        <span>{formatDate(order.createdAt)}</span>
                      </div>
                      <span className={`chip chip--${meta.tone}`}>{meta.label}</span>
                      <strong className="table-amount">{formatCurrency(order.totalAmount)}</strong>
                    </li>
                  );
                })}
            </ul>
          ) : (
            <EmptyState compact icon={MessageCircle} title="No orders yet" description="This customer has not placed an order." />
          )}
        </div>

        {customer.notes ? (
          <div className="customer-detail__notes">
            <span>Notes</span>
            <p>{customer.notes}</p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
