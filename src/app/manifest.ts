import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rate My Day",
    short_name: "Rate My Day",
    description: "Your personal year, one colored day at a time.",
    start_url: "/",
    display: "standalone",
    background_color: "#fffaf2",
    theme_color: "#fffaf2",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
