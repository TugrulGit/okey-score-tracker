import { ButtonHTMLAttributes, ReactElement } from "react";
import "./GlassButton.css";

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary";
};

export function GlassButton({
  tone = "primary",
  className,
  children,
  ...buttonProps
}: GlassButtonProps): ReactElement {
  return (
    <button
      className={`glass-button glass-button--${tone}${className ? ` ${className}` : ""}`}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
