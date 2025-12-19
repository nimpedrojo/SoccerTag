import React from "react";

type Tone = "red" | "blue" | "dark";

const cx = (...parts: Array<string | undefined | false | null>) =>
  parts.filter(Boolean).join(" ");

interface TagButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone: Tone;
  active?: boolean;
}

/**
 * Boton grande tipo tag con punto rojo al estilo del diseno de referencia.
 */
export const TagButton: React.FC<TagButtonProps> = ({
  label,
  tone,
  active,
  className,
  ...rest
}) => {
  return (
    <button
      className={cx("tag-button", `tone-${tone}`, active && "active", className)}
      {...rest}
    >
      <span className="dot" />
      <span className="label">{label}</span>
    </button>
  );
};
