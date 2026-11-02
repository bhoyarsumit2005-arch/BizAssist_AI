export default function EmptyState({ icon: Icon, title, description, action, compact = false }) {
  return (
    <div className={`empty-state ${compact ? "empty-state--compact" : ""}`}>
      {Icon ? (
        <span className="empty-state__icon">
          <Icon size={compact ? 20 : 26} />
        </span>
      ) : null}
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
