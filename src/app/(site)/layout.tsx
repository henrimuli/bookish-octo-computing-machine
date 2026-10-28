import { Suspense } from "react";
import { DebutModal } from "@/components/debut/debut-modal";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { enabledSocialProviders } from "@/lib/auth";

/** Public pages: header, footer, and the "Debut your product" modal that any page can open with `?debut=1`. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <Suspense>
        <DebutModal socialProviders={enabledSocialProviders()} />
      </Suspense>
    </>
  );
}
