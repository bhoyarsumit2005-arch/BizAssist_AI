import { Image as ImageIcon, Pencil, PackageX, Trash2 } from "lucide-react";

import { formatCurrency, initials } from "../utils/format";

const stockMeta = (stock, unit) => {
  const value = Number(stock) || 0;
  if (value <= 0) return { label: "Out of stock", tone: "danger", unit };
  if (value <= 10) return { label: `Only ${value} ${unit}${value === 1 ? "" : "s"} left`, tone: "warning", unit };
  return { label: `${value} ${unit}${value === 1 ? "" : "s"} in stock`, tone: "success", unit };
};

export default function ProductCard({ product, canManage = true, onEdit, onDelete, onToggleActive, busy = false }) {
  const stock = stockMeta(product.stock, product.unit || "piece");
  const active = product.isActive !== false;

  return (
    <article className={`product-card ${busy ? "is-busy" : ""} ${!active ? "is-inactive" : ""}`}>
      <div className="product-card__media">
        {product.image ? (
          <img src={product.image} alt={product.name} loading="lazy" />
        ) : (
          <div className="product-card__placeholder" aria-hidden="true">
            <span>{initials(product.name)}</span>
            <ImageIcon size={22} />
          </div>
        )}
        <span className={`chip chip--${stock.tone} product-card__stock`}>{stock.label}</span>
        {!active ? <span className="chip chip--neutral product-card__inactive">Inactive</span> : null}
      </div>

      <div className="product-card__body">
        <div className="product-card__title-row">
          <h3>{product.name}</h3>
          <strong>{formatCurrency(product.price)}</strong>
        </div>
        <p className="product-card__desc">{product.description || "No description added yet."}</p>
        <div className="product-card__meta">
          <span className="muted">per {product.unit || "piece"}</span>
          {canManage ? (
            <label className="switch switch--small" title={active ? "Deactivate product" : "Activate product"}>
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => onToggleActive?.(product, event.target.checked)}
                disabled={busy}
              />
              <span className="switch__track" />
            </label>
          ) : null}
        </div>
      </div>

      {canManage ? (
        <div className="product-card__actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onEdit?.(product)} disabled={busy}>
            <Pencil size={14} /> Edit
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-ghost--danger"
            onClick={() => onDelete?.(product)}
            disabled={busy}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      ) : null}
      {Number(product.stock) <= 0 ? (
        <span className="product-card__oos" aria-hidden="true">
          <PackageX size={12} /> Restock soon
        </span>
      ) : null}
    </article>
  );
}
