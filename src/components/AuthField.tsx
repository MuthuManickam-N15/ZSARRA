"use client";
import { useState } from "react";

/** Big input with a label that floats up when you type, and a show/hide switch for passwords. */
export default function AuthField({ label, name, type = "text", required = true, autoComplete, hint, prefix }: {
  label: string; name: string; type?: string; required?: boolean; autoComplete?: string; hint?: string; prefix?: string;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const id = `auth-${name}`;
  return (
    <div>
      <div className="flex">
        {prefix && <span className="flex items-center rounded-l-sm border border-r-0 border-ink/25 bg-ivory/60 px-3 text-sm font-semibold text-ink/70">{prefix}</span>}
        <div className="relative flex-1">
          <input id={id} name={name} type={isPassword && show ? "text" : type} required={required} autoComplete={autoComplete} placeholder=" "
            className={`peer h-12 w-full border border-ink/25 bg-white px-3.5 pt-3.5 text-sm outline-none transition-colors focus:border-ink ${prefix ? "rounded-r-sm" : "rounded-sm"} ${isPassword ? "pr-16" : ""}`} />
          <label htmlFor={id} className="pointer-events-none absolute left-3.5 top-3.5 origin-left text-sm text-ink/50 transition-all duration-150 peer-focus:top-1.5 peer-focus:text-[11px] peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-[11px]">
            {label}{required ? "*" : ""}
          </label>
          {isPassword && (
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-3 text-xs font-bold text-bronze">{show ? "HIDE" : "SHOW"}</button>
          )}
        </div>
      </div>
      {hint && <p className="mt-1.5 text-xs text-ink/60">{hint}</p>}
    </div>
  );
}
