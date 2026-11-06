import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Download,
  Info,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  UserCheck,
  UserPlus,
  Users
} from "lucide-react";

import EmptyState from "../components/EmptyState";
import Modal from "../components/Modal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api, { getErrorMessage } from "../services/api";
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

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
  notes: ""
};

const toForm = (customer) => ({
  name: customer?.name || "",
  phone: customer?.phone || "",
  email: customer?.email || "",
  address: customer?.address || "",
  notes: customer?.notes || ""
});

export default function Customers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canArchive = user?.role === "owner";
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [editor, setEditor] = useState({ open: false, customer: null });
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingActive, setChangingActive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([api.get("/customers"), api.get("/orders")]);
    const unauthorized = results.some(
      (result) => result.status === "rejected" && result.reason?.response?.status === 401
    );
    if (unauthorized) return;

    const failed = results.find((result) => result.status === "rejected");
    if (failed) {
      toast(getErrorMessage(failed.reason, "Could not load customers."), "error");
    }

    setCustomers(results[0].status === "fulfilled" ? results[0].value.data.customers || [] : []);
    setOrders(results[1].status === "fulfilled" ? results[1].value.data.orders || [] : []);
    setLoading(false);
  }, [toast]);

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

  const openCreate = () => {
    setForm(emptyForm);
    setFormError("");
    setEditor({ open: true, customer: null });
  };

  const openEdit = (customer) => {
    setForm(toForm(customer));
    setFormError("");
    setEditor({ open: true, customer });
  };

  const closeEditor = () => {
    if (saving) return;
    setEditor({ open: false, customer: null });
  };

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const saveCustomer = async (event) => {
    event.preventDefault();

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      notes: form.notes.trim()
    };

    if (!payload.name) {
      setFormError("Customer name is required.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      if (editor.customer) {
        const { data } = await api.put(`/customers/${editor.customer._id}`, payload);
        setCustomers((current) =>
          current.map((item) => (item._id === data.customer._id ? data.customer : item))
        );
        setSelected((current) => (current?._id === data.customer._id ? data.customer : current));
        toast("Customer updated.");
      } else {
        const { data } = await api.post("/customers", payload);
        setCustomers((current) => [data.customer, ...current]);
        toast("Customer added.");
      }

      setEditor({ open: false, customer: null });
    } catch (error) {
      setFormError(getErrorMessage(error, "Could not save this customer."));
    } finally {
      setSaving(false);
    }
  };

  const setCustomerActive = async (customer) => {
    const nextActive = customer.isActive === false;

    if (!nextActive && !window.confirm(`Archive ${customer.name}? Their order history will be kept.`)) {
      return;
    }

    setChangingActive(true);

    try {
      const { data } = nextActive
        ? await api.put(`/customers/${customer._id}`, { isActive: true })
        : await api.delete(`/customers/${customer._id}`);

      setCustomers((current) =>
        current.map((item) => (item._id === data.customer._id ? data.customer : item))
      );
      setSelected((current) => (current?._id === data.customer._id ? data.customer : current));
      toast(nextActive ? "Customer restored." : "Customer archived.");
    } catch (error) {
      toast(getErrorMessage(error, "Could not update this customer."), "error");
    } finally {
      setChangingActive(false);
    }
  };

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
          </div>
          <h2>Customers</h2>
          <p>Everyone your business has talked to, with their history in one place.</p>
        </div>
        <div className="page-head__actions">
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <UserPlus size={16} /> Add customer
          </button>
          <button type="button" className="btn btn-secondary" onClick={exportCustomers}>
            <Download size={16} /> Export
          </button>
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh
          </button>
        </div>
      </header>

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
                : "Customers are added automatically when someone gets in touch."
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
                <button type="button" className="btn btn-primary" onClick={openCreate}>
                  <UserPlus size={16} /> Add customer
                </button>
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
                  <th>Paid spend</th>
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
        <Info size={14} /> Customers are created automatically from conversations. You can also add, edit,
        or archive them here; archived records keep their order history.
      </p>

      <CustomerDetails
        customer={selected}
        orders={orders.filter((order) => {
          const id = typeof order.customerId === "string" ? order.customerId : order.customerId?._id;
          return id === selected?._id;
        })}
        stats={selected ? orderStats.get(selected._id) : null}
        onClose={() => setSelected(null)}
        onEdit={openEdit}
        onToggleActive={setCustomerActive}
        changingActive={changingActive}
        canArchive={canArchive}
      />

      <CustomerEditor
        open={editor.open}
        customer={editor.customer}
        form={form}
        error={formError}
        saving={saving}
        onChange={updateForm}
        onClose={closeEditor}
        onSubmit={saveCustomer}
      />
    </div>
  );
}

function CustomerDetails({ customer, orders, stats, onClose, onEdit, onToggleActive, changingActive, canArchive = true }) {
  if (!customer) return null;

  return (
    <Modal
      open={Boolean(customer)}
      onClose={onClose}
      title="Customer profile"
      subtitle={`Customer since ${formatDate(customer.createdAt)}`}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={() => onEdit(customer)}>
            <Pencil size={16} /> Edit
          </button>
          <button
            type="button"
            className={`btn btn-ghost ${customer.isActive === false ? "" : "btn-ghost--danger"}`}
            onClick={() => onToggleActive(customer)}
            disabled={changingActive}
            hidden={customer.isActive !== false && !canArchive}
          >
            {customer.isActive === false ? <RotateCcw size={16} /> : <Archive size={16} />}
            {customer.isActive === false ? "Restore" : "Archive"}
          </button>
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
          <div><span>Paid spend</span><strong>{formatCurrency(stats?.spent || 0)}</strong></div>
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

function CustomerEditor({ open, customer, form, error, saving, onChange, onClose, onSubmit }) {
  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? "Edit customer" : "Add customer"}
      subtitle={customer ? customer.name : "Create a customer record manually."}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="customer-form" className="btn btn-primary" disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
            {saving ? "Saving…" : "Save customer"}
          </button>
        </>
      }
    >
      <form id="customer-form" className="customer-form" onSubmit={onSubmit}>
        {error ? (
          <div className="notice notice--danger">
            <Info size={17} />
            <p>{error}</p>
          </div>
        ) : null}

        <div className="form-grid">
          <div className="field">
            <label htmlFor="customerName">Name</label>
            <input
              id="customerName"
              type="text"
              value={form.name}
              onChange={(event) => onChange("name", event.target.value)}
              placeholder="Customer name"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="customerPhone">Phone</label>
            <input
              id="customerPhone"
              type="tel"
              value={form.phone}
              onChange={(event) => onChange("phone", event.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>
          <div className="field field--full">
            <label htmlFor="customerEmail">Email</label>
            <input
              id="customerEmail"
              type="email"
              value={form.email}
              onChange={(event) => onChange("email", event.target.value)}
              placeholder="customer@example.com"
            />
          </div>
          <div className="field field--full">
            <label htmlFor="customerAddress">Address</label>
            <input
              id="customerAddress"
              type="text"
              value={form.address}
              onChange={(event) => onChange("address", event.target.value)}
              placeholder="Delivery address"
            />
          </div>
          <div className="field field--full">
            <label htmlFor="customerNotes">Notes</label>
            <textarea
              id="customerNotes"
              rows={3}
              value={form.notes}
              onChange={(event) => onChange("notes", event.target.value)}
              placeholder="Preferences, delivery instructions, anything useful…"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
