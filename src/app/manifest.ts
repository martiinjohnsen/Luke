import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Luke · Adventskalender",
    short_name: "Luke",
    description:
      "Personlige adventskalendere med små øyeblikk som bringer dere nærmere.",
    start_url: "/calendars",
    scope: "/",
    display: "standalone",
    background_color: "#f8f7f2",
    theme_color: "#655078",
    lang: "nb",
    icons: [
      {
        src: "/icons/luke-192-v3.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/luke-512-v3.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/luke-maskable-512-v3.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
