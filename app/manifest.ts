import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EduTechLab - School Management",
    short_name: "EduTechLab",
    description: "All-in-one School & Institute Management SaaS Platform",
    start_url: "/dashboard",
    id: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#171625",
    theme_color: "#6657e8",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
