"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";

type RichTextFieldProps = {
  name: string;
  defaultValue?: string | null;
};

const quickIcons = ["🌿", "🔥", "⭐", "✅", "🥘", "🍛"];

export default function RichTextField({
  name,
  defaultValue = "",
}: RichTextFieldProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const [initialValue] = useState(defaultValue ?? "");
  const currentDefaultValue = defaultValue ?? "";

  useEffect(() => {
    if (editorRef.current && document.activeElement !== editorRef.current) {
      editorRef.current.innerHTML = currentDefaultValue;
    }
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = currentDefaultValue;
    }
  }, [currentDefaultValue]);

  function syncValue() {
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = editorRef.current?.innerHTML ?? "";
    }
  }

  function keepEditorSelection(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
  }

  function runCommand(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    syncValue();
  }

  function insertText(text: string) {
    editorRef.current?.focus();
    document.execCommand("insertText", false, text);
    syncValue();
  }

  return (
    <div className="rich-text-field">
      <input ref={hiddenInputRef} type="hidden" name={name} defaultValue={initialValue} />
      <div className="rich-text-toolbar" aria-label="Description formatting">
        <button type="button" onMouseDown={keepEditorSelection} onClick={() => runCommand("bold")}>
          B
        </button>
        <button type="button" onMouseDown={keepEditorSelection} onClick={() => runCommand("italic")}>
          I
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => runCommand("insertUnorderedList")}
        >
          •
        </button>
        <button
          type="button"
          onMouseDown={keepEditorSelection}
          onClick={() => runCommand("insertOrderedList")}
        >
          1.
        </button>
        {quickIcons.map((icon) => (
          <button
            key={icon}
            type="button"
            onMouseDown={keepEditorSelection}
            onClick={() => insertText(icon)}
          >
            {icon}
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        className="rich-text-editor"
        contentEditable
        suppressContentEditableWarning
        onInput={syncValue}
        onBlur={syncValue}
        dangerouslySetInnerHTML={{ __html: initialValue }}
      />
    </div>
  );
}
