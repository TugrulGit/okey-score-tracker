import { PropsWithChildren } from "react";
import { ReactElement } from "react";

type ButtonProps = {
};


export function Button({ children }: PropsWithChildren<ButtonProps>): ReactElement {
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
      onClick={() => alert("Hello from UI-Kit!")}
    >
      {children}
    </button>
  );
}
