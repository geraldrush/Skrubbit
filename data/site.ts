/**
 * Central site configuration for Skrubb-it Products.
 *
 * ⚠️  PLACEHOLDERS: update the contact details below with the real numbers /
 * addresses before going live. The WhatsApp number drives the "order enquiry"
 * checkout, so it must be a real WhatsApp-enabled number in international
 * format (country code, digits only, no "+" or spaces).
 */
export const site = {
  name: "Skrubb-it",
  legalName: "Skrubb-it Products",
  tagline: "Powerful cleaning, proudly South African.",
  description:
    "Skrubb-it manufactures industrial and household cleaning products and personal care essentials in South Africa. Quality you can trust, at prices that make sense.",
  url: "https://skrubbit.co.za",

  // --- Contact ---
  contact: {
    // International format, digits only (e.g. 27 82 123 4567 -> "27821234567").
    // This drives the WhatsApp order enquiry, so it must be WhatsApp-enabled.
    whatsapp: "27659669657",
    phoneDisplay: "+27 65 966 9657",
    email: "orders@skrubbit.co.za",
    location: "Limpopo, South Africa",
  },

  socials: {
    facebook: "https://www.facebook.com/skrubbit",
    takealot: "https://www.takealot.com",
    instagram: "",
  },

  // Free-delivery threshold used in cart messaging (Rand). Set to 0 to hide.
  freeDeliveryOver: 750,
} as const;

export type Site = typeof site;
