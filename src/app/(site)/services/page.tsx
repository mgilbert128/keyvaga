import { redirect } from "next/navigation";

/** The services marketplace lives in the owner portal (owners only). Old links land there. */
export default function ServicesRedirect() {
  redirect("/owner/services");
}
