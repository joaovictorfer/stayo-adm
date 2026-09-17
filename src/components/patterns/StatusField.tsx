import { useEffect, useId, useState } from "react";

/**
 * Edição inline de um campo de status ainda livre (string solta, sem enum
 * fechado no contrato — o Core é quem vai definir a taxonomia final).
 * `suggestions` só preenche o datalist, nunca restringe o valor digitado.
 */
export function StatusField({
  value,
  suggestions,
  onSave,
  saving,
}: {
  value: string;
  suggestions: string[];
  onSave: (value: string) => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const listId = useId();

  useEffect(() => setDraft(value), [value]);

  const dirty = draft.trim() !== "" && draft !== value;

  return (
    <div className="flex items-center gap-2">
      <input
        list={listId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={saving}
        className="rounded-[var(--radius-control)] border px-2 py-1 text-sm outline-none disabled:opacity-60"
        style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {dirty && (
        <button
          type="button"
          onClick={() => onSave(draft.trim())}
          disabled={saving}
          className="rounded-[var(--radius-control)] px-2 py-1 text-xs disabled:opacity-60"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      )}
    </div>
  );
}
