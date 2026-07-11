"use client";

import { useState } from "react";

const MAX_IMAGE_DIMENSION = 1200;
const TARGET_IMAGE_BYTES = 150 * 1024;
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;

const assetOptions = [
  "/assets/veg-thali.png",
  "/assets/nonveg-thali.png",
  "/assets/Butter Chicken.png",
  "/assets/Chicken Biryani.jpeg",
  "/assets/Chicken Puff.png",
  "/assets/Dal Vada.png",
  "/assets/Egg Puff.png",
  "/assets/Ghee roast .png",
  "/assets/Idli Sambar.png",
  "/assets/Idli-dosa batter.png",
  "/assets/Kerala Chicken Biryani.png",
  "/assets/Kerala Mutton Biryani.png",
  "/assets/Medu Vada.png",
  "/assets/Medu Vada Battter.png",
  "/assets/Onion Pakoda.png",
  "/assets/Pahadi Chicken curry.png",
  "/assets/Put Kadala.jpeg",
  "/assets/Puttu and Kadala Curry.png",
  "/assets/Sabudana Vada.png",
];

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
  const [processing, setProcessing] = useState(false);

  async function compressImage(file: File) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Please choose a JPG, PNG, WebP, or other browser-supported image.");
    }
    if (file.size > MAX_SOURCE_BYTES) {
      throw new Error("The original image must be 12 MB or smaller.");
    }

    const bitmap = await createImageBitmap(file);
    let scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    let quality = 0.84;
    let result = "";

    for (let attempt = 0; attempt < 7; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        bitmap.close();
        throw new Error("This browser could not process the image.");
      }
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      result = canvas.toDataURL("image/webp", quality);
      const resultBytes = Math.ceil((result.length - result.indexOf(",") - 1) * 0.75);
      if (resultBytes <= TARGET_IMAGE_BYTES) {
        bitmap.close();
        return { result, width: canvas.width, height: canvas.height, resultBytes };
      }
      quality = Math.max(0.52, quality - 0.08);
      scale *= 0.86;
    }

    bitmap.close();
    throw new Error("The image could not be compressed enough. Please use a smaller image.");
  }

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
        <select
          value={assetOptions.includes(value) ? value : ""}
          onChange={(event) => {
            setValue(event.target.value);
            setStatus(event.target.value ? "Image selected" : "");
          }}
        >
          <option value="">Choose existing image</option>
          {assetOptions.map((asset) => (
            <option key={asset} value={asset}>
              {asset.replace("/assets/", "")}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={value}
          placeholder="/assets/veg-thali.png"
          onChange={(event) => {
            setValue(event.target.value);
            setStatus("");
          }}
        />
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          disabled={processing}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setProcessing(true);
            setStatus("Compressing image…");
            try {
              const compressed = await compressImage(file);
              setValue(compressed.result);
              setStatus(
                `Ready: ${compressed.width} × ${compressed.height}, ${Math.round(compressed.resultBytes / 1024)} KB WebP`,
              );
            } catch (error) {
              setStatus(error instanceof Error ? error.message : "Image processing failed.");
            } finally {
              setProcessing(false);
              event.target.value = "";
            }
          }}
        />
        <span className="image-upload-status">
          Recommended: 1200 × 900 px (4:3). Uploads are automatically resized and compressed.
        </span>
        {status ? <span className="image-upload-status">{status}</span> : null}
      </div>
    </div>
  );
}
