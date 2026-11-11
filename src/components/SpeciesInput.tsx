import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { searchSpecies, type Species } from "@/lib/species";
import { cn } from "@/lib/utils";

/**
 * Species field: type freely, or pick from suggestions that filter as you type.
 * Anything typed is kept as-is, so plants not on the list still work.
 */
export function SpeciesInput({
  value,
  onChange,
  onPick,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Called after a suggestion is chosen (e.g. to fill in an empty name). */
  onPick?: (species: Species) => void;
  className?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => searchSpecies(value), [value]);
  const showList = open && results.length > 0;

  function pick(s: Species) {
    onChange(s.name);
    onPick?.(s);
    setOpen(false);
    setActive(-1);
  }

  function move(to: number) {
    setActive(to);
    listRef.current?.children[to]?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else if (results.length) move(Math.min(results.length - 1, active + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length) move(Math.max(0, active - 1));
    } else if (e.key === "Enter" && showList && active >= 0) {
      e.preventDefault(); // pick the suggestion instead of submitting the form
      pick(results[active]);
    } else if (e.key === "Escape" && showList) {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${id}-${active}` : undefined}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Species (optional, e.g. pothos)"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
        className={className}
      />
      {showList && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Species suggestions"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto overscroll-contain rounded-[var(--radius-md)] border bg-popover py-1 text-popover-foreground shadow-lg"
        >
          {results.map((s, i) => (
            <li
              key={s.name}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown (not click) so the input doesn't blur and close the list first
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("cursor-pointer px-4 py-2.5", i === active && "bg-accent text-accent-foreground")}
            >
              <span className="block">{s.common}</span>
              <span className="block text-sm italic text-muted-foreground">{s.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
