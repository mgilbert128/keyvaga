import { SiteFooter } from "@/components/layout/SiteHeader";

/** Homepage: the header lives inside the hero photo, so no standard site header here. */
export default function HomeLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main id="main" className="w-full flex-1 pb-16">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
