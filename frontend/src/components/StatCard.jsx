import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { MiniSparkline } from "./Charts";

export default function StatCard({
  icon: Icon,
  label,
  value,
  change,
  hint,
  tone = "emerald",
  sparkline = [],
  sparkColor
}) {
  const positive = typeof change === "number" ? change >= 0 : null;
  const colors = {
    emerald: "#5c7000",
    blue: "#3b82f6",
    violet: "#7c3aed",
    amber: "#f59e0b",
    rose: "#f43f5e",
    cyan: "#0891b2"
  };

  return (
    <article className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__top">
        <span className="stat-card__icon">{Icon ? <Icon size={19} /> : null}</span>
        {typeof change === "number" ? (
          <span className={`stat-card__change ${positive ? "is-up" : "is-down"}`}>
            {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(change)}%
          </span>
        ) : null}
      </div>
      <p className="stat-card__label">{label}</p>
      <div className="stat-card__value-row">
        <h3 className="stat-card__value">{value}</h3>
        {sparkline.length ? (
          <MiniSparkline data={sparkline} color={sparkColor || colors[tone]} />
        ) : null}
      </div>
      {hint ? <p className="stat-card__hint">{hint}</p> : null}
    </article>
  );
}
