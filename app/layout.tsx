import { ModeToggle } from "@/app/_components-navbar/mode-toggle";
import { Toaster } from "@/components/ui/toaster";
import AuthStatus from "./_components-navbar/auth-status";
import Navbar from "./_components-navbar/navbar";
import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "Emilie's Time Tracker", // Change this
  description: "Track what I'm working on and visualize my time", // And this
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Hydration warning suppressed because of next-themes https://github.com/pacocoursey/next-themes */}
      <body>
        <Providers>
          <div className="flex-col md:flex">
            <div className="border-b">
              <div className="flex h-16 items-center px-4">
                <Navbar className="mx-6" />
                <div className="ml-auto flex items-center space-x-4">
                  <ModeToggle />
                  <AuthStatus />
                </div>
              </div>
            </div>
            {/* Conditionally display website if logged in, else display login page */}
            <div className="space-y-6 p-10 pb-16 md:block">
              <main>{children}</main>
            </div>
          </div>
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
