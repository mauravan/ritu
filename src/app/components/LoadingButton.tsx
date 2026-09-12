"use client";
import Spinner from "./Spinner";

export default function LoadingButton({
  isLoading,
  disabled,
  onClick,
  type = "submit",
  className = "",
  children,
}: {
  isLoading: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: "submit" | "button";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={className}
    >
      {isLoading ? <Spinner size={18} /> : children}
    </button>
  );
}
