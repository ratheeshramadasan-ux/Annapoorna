"use client";

import { useState } from "react";

export default function PasswordField({
  name,
  required,
}: {
  name: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <input name={name} type={visible ? "text" : "password"} required={required} />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((current) => !current)}
      >
        <span className={visible ? "eye-icon visible" : "eye-icon"} />
      </button>
    </div>
  );
}
