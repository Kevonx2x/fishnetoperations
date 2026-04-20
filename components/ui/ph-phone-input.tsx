"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PH_PHONE,
  normalizePhoneFieldInput,
  validatePhilippinePhoneInput,
  isPhilippinePhoneMode,
} from "@/lib/phone-ph";
import { compactPhoneForE164, E164_INVALID_MESSAGE, isE164Compact } from "@/lib/validation/e164-phone";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

export function PhPhoneInput({
  id: idProp,
  value,
  onChange,
  onBlur,
  disabled,
  required,
  className,
  inputClassName,
  placeholder = "+63 9XX XXX XXXX",
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: Props) {
  const genId = useId();
  const id = idProp ?? `ph-phone-${genId.replace(/:/g, "")}`;

  const error = (() => {
    const t = value.trim();
    if (!t || t === "+63") return null;
    if (isPhilippinePhoneMode(value)) return validatePhilippinePhoneInput(value);
    if (t.startsWith("+")) {
      return isE164Compact(value) ? null : E164_INVALID_MESSAGE;
    }
    if (compactPhoneForE164(t).length > 0) {
      return "Include a country code with + (e.g. +63 for Philippines).";
    }
    return null;
  })();

  return (
    <div className={cn("space-y-1", className)}>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        disabled={disabled}
        required={required}
        value={value}
        placeholder={placeholder}
        aria-invalid={ariaInvalid ?? Boolean(error)}
        aria-describedby={ariaDescribedBy}
        onChange={(e) => {
          let next = e.target.value;
          if (next === "") {
            onChange("");
            return;
          }
          next = normalizePhoneFieldInput(next);
          onChange(next);
        }}
        onFocus={(e) => {
          if (e.target.value === "") {
            onChange(DEFAULT_PH_PHONE);
          }
        }}
        className={cn(
          "mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/60",
          error ? "border-red-400" : "border-[#2C2C2C]/10",
          inputClassName,
        )}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
