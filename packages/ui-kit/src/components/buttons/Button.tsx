import {
  ButtonHTMLAttributes,
  PropsWithChildren,
  ReactElement,
} from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  children,
  ...rest
}: PropsWithChildren<ButtonProps>): ReactElement {
  return (
    <button
      style={{
        padding: "0.5rem 1rem",
        borderRadius: "0.5rem",
        border: "none",
        background: "#ff9e42",
        color: "#fff",
        cursor: "pointer",
        fontWeight: 600,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
