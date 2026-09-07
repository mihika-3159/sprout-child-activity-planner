import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sprout Planner — Evidence-grounded screen-free activity plans for children",
  description:
    "Tell us what your child enjoys, what you have at home, and how much involvement you want. We'll build a personalised week of evidence-informed screen-free activities.",
  keywords: [
    "children activities",
    "screen free",
    "activity planner",
    "independent play",
    "child development",
    "parenting",
  ],
  openGraph: {
    title: "Sprout Planner",
    description: "Evidence-grounded screen-free activity plans for children",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#faf8f4" />
      </head>
      <body>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 btn btn-primary">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
