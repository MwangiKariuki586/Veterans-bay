import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AuthCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-md rounded-[28px] border border-black/8 bg-white shadow-[0_24px_60px_rgba(7,21,34,0.12)]",
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-t-[28px] bg-[#071522] px-8 pt-10 pb-9 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          aria-hidden="true"
          style={{
            background:
              "linear-gradient(135deg, transparent 42%, rgba(10,30,45,0.95) 42.5%, rgba(10,30,45,0.95) 58%, transparent 58.5%), linear-gradient(225deg, transparent 35%, rgba(200,244,61,0.08) 36%, transparent 70%)",
          }}
        />
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="rounded-xl bg-white/95 px-3 py-2 shadow-[0_8px_22px_rgba(0,0,0,0.14)]">
            <Image
              src="/images/veterans-bay-logo.png"
              alt=""
              width={1249}
              height={389}
              className="h-auto w-[205px] object-contain"
              sizes="205px"
            />
          </div>
          <p className="mt-8 text-2xl" aria-hidden="true">
            👋
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-title">{title}</h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-white/75">{subtitle}</p>
        </div>
      </div>
      <div className="px-8 py-8">{children}</div>
    </div>
  );
}

export function AuthUnderlineField({
  id,
  name,
  type = "text",
  placeholder,
  autoComplete,
  icon,
  required,
  minLength,
  defaultValue,
  disabled,
  readOnly,
  value,
}: {
  id: string;
  name?: string;
  type?: string;
  placeholder: string;
  autoComplete?: string;
  icon: ReactNode;
  required?: boolean;
  minLength?: number;
  defaultValue?: string;
  disabled?: boolean;
  readOnly?: boolean;
  value?: string;
}) {
  return (
    <label className="flex items-center gap-3 border-b border-black/12 pb-3">
      <span className="sr-only">{placeholder}</span>
      <span className="text-[#68717b]" aria-hidden="true">
        {icon}
      </span>
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        defaultValue={defaultValue}
        disabled={disabled}
        readOnly={readOnly}
        value={value}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#9aa3ab] disabled:opacity-60"
      />
    </label>
  );
}
