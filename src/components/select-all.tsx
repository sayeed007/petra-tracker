"use client";

/** Ticks or clears every checkbox named "ids" on the page (the rows of the issue list). */
export function SelectAll({ label }: Readonly<{ label: string }>) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      onChange={(event) => {
        const checked = event.currentTarget.checked;
        document.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="ids"]').forEach((box) => {
          box.checked = checked;
        });
      }}
    />
  );
}
