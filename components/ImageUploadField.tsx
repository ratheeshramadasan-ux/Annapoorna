"use client";

import { useState } from "react";

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
        <span className="image-upload-status">
          Store image paths only. Add new files under public/assets before using them here.
        </span>
        {status ? <span className="image-upload-status">{status}</span> : null}
      </div>
    </div>
  );
}
