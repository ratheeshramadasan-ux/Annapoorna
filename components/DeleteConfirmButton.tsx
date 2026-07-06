"use client";

import { useState } from "react";

type DeleteConfirmButtonProps = {
  action: (formData: FormData) => Promise<void>;
  id: number;
  idFieldName?: string;
  confirmMessage: string;
  buttonText?: string;
  className?: string;
};

export default function DeleteConfirmButton({
  action,
  id,
  idFieldName = "id",
  confirmMessage,
  buttonText = "Delete",
  className = "danger-button",
}: DeleteConfirmButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <form
      action={action}
      className="inline-form"
      onSubmit={(event) => {
        const confirmed = window.confirm(confirmMessage);
        if (!confirmed) {
          event.preventDefault();
          return;
        }
        setIsDeleting(true);
      }}
    >
      <input type="hidden" name={idFieldName} value={id} />
      <button className={className} type="submit" disabled={isDeleting}>
        {isDeleting ? "Deleting..." : buttonText}
      </button>
    </form>
  );
}
