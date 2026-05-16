export interface PublicTokenActionItem {
  id: string;
  title: string;
  detail: string;
  status: string;
  tone?: "neutral" | "ready" | "risk";
}

export function PublicTokenNeedsAttention({
  items,
  emptyLabel,
}: {
  items: PublicTokenActionItem[];
  emptyLabel: string;
}) {
  return (
    <div className="public-form-section public-needs-attention">
      <div className="section-title">
        <h2>Needs attention</h2>
        <span>{items.length ? `${items.length} open` : "clear"}</span>
      </div>
      {items.length ? (
        <div className="public-form-items">
          {items.map((item) => (
            <div className="public-form-action public-attention-item" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </div>
              <span className={item.tone === "risk" ? "risk" : undefined}>{item.status}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="inline-empty">{emptyLabel}</p>
      )}
    </div>
  );
}
