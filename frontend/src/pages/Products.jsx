import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownUp,
  Boxes,
  Image as ImageIcon,
  Info,
  LayoutGrid,
  List,
  Loader2,
  Package,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X
} from "lucide-react";

import EmptyState from "../components/EmptyState";
import Modal from "../components/Modal";
import ProductCard from "../components/ProductCard";
import { useToast } from "../context/ToastContext";
import api, { getErrorMessage } from "../services/api";
import { demoProducts } from "../services/demo";
import { formatCurrency, formatNumber, formatDate } from "../utils/format";

const emptyForm = {
  name: "",
  price: "",
  stock: "",
  unit: "piece",
  description: "",
  image: "",
  isActive: true
};

const units = ["piece", "pack", "box", "bottle", "kg", "gram", "litre", "set", "pair", "service"];

const toForm = (product) => ({
  name: product?.name || "",
  price: product?.price ?? "",
  stock: product?.stock ?? "",
  unit: product?.unit || "piece",
  description: product?.description || "",
  image: product?.image || "",
  isActive: product?.isActive !== false
});

export default function Products() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState("grid");
  const [editor, setEditor] = useState({ open: false, product: null });
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/products");
      setProducts(data.products || []);
      setPreview(false);
    } catch (error) {
      if (error?.response?.status === 401) return;
      setProducts(demoProducts);
      setPreview(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = useCallback(() => {
    setForm(emptyForm);
    setFormError("");
    setEditor({ open: true, product: null });
  }, []);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      openCreate();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, openCreate]);

  const openEdit = (product) => {
    setForm(toForm(product));
    setFormError("");
    setEditor({ open: true, product });
  };

  const closeEditor = () => {
    if (saving) return;
    setEditor({ open: false, product: null });
  };

  const update = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    if (formError) setFormError("");
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!form.name.trim()) {
      setFormError("Give your product a name.");
      return;
    }
    if (form.price === "" || Number(form.price) < 0 || Number.isNaN(Number(form.price))) {
      setFormError("Enter a valid price of 0 or more.");
      return;
    }
    if (form.stock !== "" && (Number(form.stock) < 0 || Number.isNaN(Number(form.stock)))) {
      setFormError("Stock must be a number of 0 or more.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      price: Number(form.price),
      stock: form.stock === "" ? 0 : Number(form.stock),
      unit: form.unit,
      description: form.description.trim(),
      image: form.image.trim(),
      isActive: form.isActive
    };

    setSaving(true);
    try {
      if (preview) {
        if (editor.product) {
          setProducts((current) =>
            current.map((item) => (item._id === editor.product._id ? { ...item, ...payload } : item))
          );
        } else {
          setProducts((current) => [
            {
              ...payload,
              _id: `preview-${Date.now()}`,
              createdAt: new Date().toISOString()
            },
            ...current
          ]);
        }
        toast(editor.product ? "Product updated in preview mode." : "Product added in preview mode.", "info");
      } else if (editor.product) {
        const { data } = await api.put(`/products/${editor.product._id}`, payload);
        setProducts((current) =>
          current.map((item) => (item._id === editor.product._id ? data.product : item))
        );
        toast("Product updated successfully.");
      } else {
        const { data } = await api.post("/products", payload);
        setProducts((current) => [data.product, ...current]);
        toast("Product added successfully.");
      }
      setEditor({ open: false, product: null });
    } catch (error) {
      setFormError(getErrorMessage(error, "Could not save the product."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      if (preview) {
        setProducts((current) => current.filter((item) => item._id !== deleteTarget._id));
        toast("Product removed in preview mode.", "info");
      } else {
        await api.delete(`/products/${deleteTarget._id}`);
        setProducts((current) => current.filter((item) => item._id !== deleteTarget._id));
        toast("Product deleted.");
      }
      setDeleteTarget(null);
    } catch (error) {
      toast(getErrorMessage(error, "Could not delete the product."), "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (product, isActive) => {
    setBusyId(product._id);
    const previous = products;

    setProducts((current) =>
      current.map((item) => (item._id === product._id ? { ...item, isActive } : item))
    );

    try {
      if (!preview) {
        await api.put(`/products/${product._id}`, { isActive });
        toast(isActive ? "Product is now active." : "Product paused.");
      } else {
        toast(isActive ? "Product activated in preview mode." : "Product paused in preview mode.", "info");
      }
    } catch (error) {
      setProducts(previous);
      toast(getErrorMessage(error, "Could not update the product."), "error");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    let list = products.filter((product) => {
      const matchesSearch =
        !term ||
        product.name?.toLowerCase().includes(term) ||
        product.description?.toLowerCase().includes(term);

      if (!matchesSearch) return false;
      if (filter === "active") return product.isActive !== false;
      if (filter === "inactive") return product.isActive === false;
      if (filter === "low") return Number(product.stock) <= 10 && product.isActive !== false;
      if (filter === "out") return Number(product.stock) === 0;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sort === "price-high") return Number(b.price) - Number(a.price);
      if (sort === "price-low") return Number(a.price) - Number(b.price);
      if (sort === "stock") return Number(a.stock) - Number(b.stock);
      if (sort === "name") return (a.name || "").localeCompare(b.name || "");
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    return list;
  }, [products, search, filter, sort]);

  const stats = useMemo(() => {
    const active = products.filter((product) => product.isActive !== false).length;
    const low = products.filter((product) => product.isActive !== false && Number(product.stock) <= 10).length;
    const value = products.reduce((total, product) => total + (Number(product.price) || 0) * (Number(product.stock) || 0), 0);
    return { active, low, value };
  }, [products]);

  return (
    <div className="page products-page">
      <header className="page-head">
        <div>
          <div className="page-head__eyebrow">
            <span>Catalogue</span>
            {preview ? <span className="chip chip--preview">Sample data</span> : null}
          </div>
          <h2>Products</h2>
          <p>Everything your assistant can sell, recommend, and answer questions about.</p>
        </div>
        <div className="page-head__actions">
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? "spin" : ""} /> Refresh
          </button>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus size={17} /> Add product
          </button>
        </div>
      </header>

      {preview ? (
        <div className="notice notice--preview">
          <Info size={17} />
          <p>
            <strong>Design preview.</strong> The API is unreachable, so changes are kept in this browser session only.
          </p>
        </div>
      ) : null}

      {stats.low ? (
        <div className="notice notice--warning">
          <AlertTriangle size={17} />
          <p>
            <strong>{stats.low} product{stats.low === 1 ? "" : "s"} need attention.</strong> Low stock can stop your
            assistant from confirming orders.
          </p>
          <button type="button" className="link-btn" onClick={() => setFilter("low")}>
            Show low stock
          </button>
        </div>
      ) : null}

      <section className="product-stats" aria-label="Product summary">
        <div className="compact-stat">
          <span className="compact-stat__icon compact-stat__icon--emerald"><Package size={17} /></span>
          <div><span>Total products</span><strong>{formatNumber(products.length)}</strong></div>
        </div>
        <div className="compact-stat">
          <span className="compact-stat__icon compact-stat__icon--blue"><PackageCheck size={17} /></span>
          <div><span>Active</span><strong>{formatNumber(stats.active)}</strong></div>
        </div>
        <div className="compact-stat">
          <span className="compact-stat__icon compact-stat__icon--amber"><AlertTriangle size={17} /></span>
          <div><span>Low or out of stock</span><strong>{formatNumber(stats.low)}</strong></div>
        </div>
        <div className="compact-stat">
          <span className="compact-stat__icon compact-stat__icon--violet"><Boxes size={17} /></span>
          <div><span>Inventory value</span><strong>{formatCurrency(stats.value)}</strong></div>
        </div>
      </section>

      <section className="card products-card">
        <div className="toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              type="search"
              placeholder="Search products…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search products"
            />
            {search ? (
              <button type="button" className="search-box__clear" onClick={() => setSearch("")} aria-label="Clear search">
                <X size={14} />
              </button>
            ) : null}
          </div>

          <div className="toolbar__group">
            <div className="segmented segmented--scroll">
              {[
                ["all", "All"],
                ["active", "Active"],
                ["low", "Low stock"],
                ["out", "Out"],
                ["inactive", "Paused"]
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
              <ArrowDownUp size={15} />
              <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products">
                <option value="newest">Newest first</option>
                <option value="name">Name A–Z</option>
                <option value="price-high">Price: high to low</option>
                <option value="price-low">Price: low to high</option>
                <option value="stock">Lowest stock</option>
              </select>
            </div>

            <div className="view-toggle" role="group" aria-label="View style">
              <button
                type="button"
                className={view === "grid" ? "is-active" : ""}
                onClick={() => setView("grid")}
                aria-label="Grid view"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                type="button"
                className={view === "list" ? "is-active" : ""}
                onClick={() => setView("list")}
                aria-label="Table view"
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="product-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <div className="product-card product-card--skeleton" key={index}>
                <span className="skeleton skeleton--media" />
                <span className="skeleton skeleton--label" />
                <span className="skeleton skeleton--value" />
                <span className="skeleton skeleton--hint" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={products.length ? Search : Package}
            title={products.length ? "No products match those filters" : "Add your first product"}
            description={
              products.length
                ? "Try a different search term or clear the filters."
                : "Your AI assistant needs a catalogue before it can answer questions or take orders."
            }
            action={
              products.length ? (
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
                  <Plus size={16} /> Add product
                </button>
              )
            }
          />
        ) : view === "grid" ? (
          <div className="product-grid">
            {filtered.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
                onToggleActive={handleToggleActive}
                busy={busyId === product._id}
              />
            ))}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => {
                  const stock = Number(product.stock) || 0;
                  return (
                    <tr key={product._id}>
                      <td>
                        <div className="table-person">
                          <span className="table-thumb">
                            {product.image ? <img src={product.image} alt="" /> : product.name?.slice(0, 1).toUpperCase()}
                          </span>
                          <div>
                            <strong>{product.name}</strong>
                            <span className="truncate">{product.description || "No description"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="table-amount">{formatCurrency(product.price)}</td>
                      <td>
                        <span className={`chip chip--${stock === 0 ? "danger" : stock <= 10 ? "warning" : "success"}`}>
                          {stock === 0 ? "Out of stock" : `${stock} ${product.unit || "piece"}${stock === 1 ? "" : "s"}`}
                        </span>
                      </td>
                      <td>
                        <span className={`chip chip--${product.isActive === false ? "neutral" : "success"}`}>
                          {product.isActive === false ? "Paused" : "Active"}
                        </span>
                      </td>
                      <td className="muted">{formatDate(product.createdAt)}</td>
                      <td>
                        <div className="table-actions">
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(product)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn--danger"
                            onClick={() => setDeleteTarget(product)}
                            aria-label={`Delete ${product.name}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
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
            <span>Showing {filtered.length} of {products.length} products</span>
            <span className="muted">Prices in INR · stock updates instantly</span>
          </footer>
        ) : null}
      </section>

      <Modal
        open={editor.open}
        onClose={closeEditor}
        title={editor.product ? "Edit product" : "Add a product"}
        subtitle={editor.product ? "Update details your assistant uses in conversations." : "New products become available to your assistant immediately."}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={closeEditor} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="product-form" className="btn btn-primary" disabled={saving}>
              {saving ? <Loader2 size={16} className="spin" /> : null}
              {saving ? "Saving…" : editor.product ? "Save changes" : "Add product"}
            </button>
          </>
        }
      >
        <form id="product-form" className="form-grid" onSubmit={handleSave} noValidate>
          {formError ? (
            <div className="alert alert--error form-grid__full" role="alert">
              <AlertTriangle size={16} />
              <span>{formError}</span>
            </div>
          ) : null}

          <div className="field field--full">
            <label htmlFor="productName">Product name</label>
            <input
              id="productName"
              type="text"
              placeholder="e.g. Scented Soy Candle"
              value={form.name}
              onChange={update("name")}
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="productPrice">Price (₹)</label>
            <input
              id="productPrice"
              type="number"
              min="0"
              step="0.01"
              placeholder="649"
              value={form.price}
              onChange={update("price")}
            />
          </div>

          <div className="field">
            <label htmlFor="productStock">Stock quantity</label>
            <input
              id="productStock"
              type="number"
              min="0"
              step="1"
              placeholder="42"
              value={form.stock}
              onChange={update("stock")}
            />
          </div>

          <div className="field">
            <label htmlFor="productUnit">Sold by</label>
            <div className="select-wrap">
              <select id="productUnit" value={form.unit} onChange={update("unit")}>
                {units.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="productImage">Image URL <span className="optional">optional</span></label>
            <div className="input-affix">
              <ImageIcon size={17} />
              <input
                id="productImage"
                type="url"
                placeholder="https://…"
                value={form.image}
                onChange={update("image")}
              />
            </div>
          </div>

          <div className="field field--full">
            <label htmlFor="productDescription">Description <span className="optional">optional</span></label>
            <textarea
              id="productDescription"
              rows={3}
              placeholder="What makes this product special? Your assistant uses this to answer questions."
              value={form.description}
              onChange={update("description")}
            />
          </div>

          {form.image ? (
            <div className="image-preview field--full">
              <img src={form.image} alt="Product preview" />
              <span>Image preview</span>
            </div>
          ) : null}

          <label className="switch-row field--full">
            <div>
              <strong>Available to your assistant</strong>
              <p>Paused products stay in your catalogue but cannot be sold.</p>
            </div>
            <span className="switch">
              <input type="checkbox" checked={form.isActive} onChange={update("isActive")} />
              <span className="switch__track" />
            </span>
          </label>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => (deleting ? null : setDeleteTarget(null))}
        title="Delete product?"
        subtitle="This cannot be undone."
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Keep product
            </button>
            <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
              {deleting ? "Deleting…" : "Delete product"}
            </button>
          </>
        }
      >
        <div className="confirm-body">
          <span className="confirm-icon"><Trash2 size={22} /></span>
          <p>
            <strong>{deleteTarget?.name}</strong> will be removed from your catalogue. Existing orders keep their
            item history.
          </p>
        </div>
      </Modal>
    </div>
  );
}
