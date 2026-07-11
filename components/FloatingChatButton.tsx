import { settingBool } from "@/lib/db";

function normalizeWhatsappNumber(value?: string) {
  return (value ?? "").replace(/[^\d]/g, "");
}

export default function FloatingChatButton({
  settings,
}: {
  settings: Record<string, string>;
}) {
  if (!settingBool(settings, "customer_chat_enabled", true)) {
    return null;
  }

  const whatsappNumber = normalizeWhatsappNumber(settings.business_whatsapp_number || "14034814101");
  if (!whatsappNumber) {
    return null;
  }

  const label = settings.customer_chat_label?.trim() || "Chat with us";
  const message = encodeURIComponent(
    settings.customer_chat_welcome_message?.trim() || "Hi Annapoorna, I have a question.",
  );

  return (
    <a
      className="floating-chat-button"
      href={`https://wa.me/${whatsappNumber}?text=${message}`}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
    >
      <span className="floating-chat-icon" aria-hidden="true">✦</span>
      {label}
    </a>
  );
}
