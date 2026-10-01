// The design's two faces, self-hosted by next/font at build time (no request
// to Google from the browser). Exposed as CSS variables that vendor-shell.css
// maps onto --font-sans / --font-serif inside the shell only.
import { DM_Sans, Manrope } from "next/font/google";

export const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});
