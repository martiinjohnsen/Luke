import type { Metadata, Viewport } from "next";
import { Provider } from "@/components/provider";
import { PwaProvider } from "@/components/pwa";
import { Shell } from "@/components/shell";
import { AccountProvider } from "@/components/account-provider";
import { GlassProvider } from "@/components/glass-provider";
import { GreetingsProvider } from "@/components/greetings-provider";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Luke · Små øyeblikk, litt nærmere",
    template: "%s · Luke",
  },
  description:
    "Lag en personlig adventskalender til noen du er glad i. 24 små øyeblikk med hilsener, bilder, quiz og opplevelser.",
  applicationName: "Luke",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Luke" },
  icons: {
    icon: [
      { url: "/icons/luke-favicon-v3.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/luke-192-v3.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/luke-apple-touch-v3.png",
  },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f8f7f2",
  viewportFit: "cover",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nb">
      <body>
        <PwaProvider>
          <AccountProvider>
            <GlassProvider>
              <Provider><GreetingsProvider><Shell>{children}</Shell></GreetingsProvider></Provider>
            </GlassProvider>
          </AccountProvider>
        </PwaProvider>
      </body>
    </html>
  );
}
