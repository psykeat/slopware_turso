export function MailLabels({
  labels,
}: {
  labels: Array<{ id?: string; name?: string; color?: string }>;
}) {
  if (!labels?.length) return null;
  return (
    <div className="flex gap-1">
      {labels.map((label, index) => (
        <span key={label.id ?? index} className="rounded-full border px-2 py-0.5 text-xs">
          {label.name ?? label.id ?? "label"}
        </span>
      ))}
    </div>
  );
}
