import { SiteFooter, SiteHeader } from "@/components/layout/SiteHeader";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-8">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
