import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { defaultLandingFor } from "@/lib/auth/roles";
import { logout } from "@/app/actions/auth";
import { ButtonLink, Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Card";

const navLink = "inline-flex min-h-11 items-center rounded-control px-3 text-base text-ink hover:bg-soft";

/** The part of the header that depends on who is signed in. Rendered inside <Suspense>. */
export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <>
        <Link href="/login" className={navLink}>
          Log in
        </Link>
        <ButtonLink href="/signup">Sign up</ButtonLink>
      </>
    );
  }
  return (
    <>
      <Link href={defaultLandingFor(user.roles)} className={navLink}>
        My portal
      </Link>
      {user.roles.includes("ADMIN") ? (
        <Link href="/admin" className={navLink}>
          Admin
        </Link>
      ) : null}
      <form action={logout}>
        <Button type="submit" variant="ghost">
          Log out
        </Button>
      </form>
      <Avatar name={user.name} />
    </>
  );
}

export function UserMenuFallback() {
  return <span className="inline-block h-11 w-40" aria-hidden="true" />;
}
