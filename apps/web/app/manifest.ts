import type { MetadataRoute } from "next";

/** Web app manifest: "Add to Home Screen" on the iPhone (needed for push). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Golf ChallengePoint",
    short_name: "ChallengePoint",
    description: "Your golf missions, streaks and coach feedback.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: "#15803d",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
