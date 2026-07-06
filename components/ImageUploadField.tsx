"use client";

import { useRef, useState } from "react";

const maxImageDimension = 900;
const jpegQuality = 0.78;

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function compressImage(file: File) {
  const dataUrl = await readAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, maxImageDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return dataUrl;
  }
  context.fillStyle = "#fffefb";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", jpegQuality);
}

export default function ImageUploadField({
  name,
  defaultValue = "",
  label = "Image",
}: {
  name: string;
  defaultValue?: string;
  label?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [status, setStatus] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="image-upload-field">
      <input type="hidden" name={name} value={value} />
      <div className="image-upload-preview">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Selected menu item" />
        ) : (
          <span>No image selected</span>
        )}
      </div>
      <div className="image-upload-controls">
        <button type="button" onClick={() => inputRef.current?.click()}>
          Upload {label}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }
            setStatus("Preparing image...");
            try {
              const compressed = await compressImage(file);
              setValue(compressed);
              setStatus("Image ready");
            } catch {
              setStatus("Could not prepare image. Try a smaller file.");
            } finally {
              event.target.value = "";
            }
          }}
        />
        <input
          type="text"
          value={value.startsWith("data:") ? "Uploaded image selected" : value}
          placeholder="/assets/veg-thali.png"
          onChange={(event) => setValue(event.target.value)}
        />
        {status ? <span className="image-upload-status">{status}</span> : null}
      </div>
    </div>
  );
}
