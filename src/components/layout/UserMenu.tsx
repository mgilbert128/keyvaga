import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { logout } from "@/app/actions/auth";
import { ButtonLink, Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Card";
import { ModeSwitch } from "@/components/mode/ModeSwitch";

const inkLink = "inline-flex min-h-11 items-center rounded-control px-3 text-base text-ink hover:bg-soft";
export const photoLink = "inline-flex min-h-11 items-center rounded-full px-3 text-base font-medium text-white hover:bg-white/15";
const photoPill = "inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 font-semibold text-brand shadow-sm hover:bg-ivory";

/** The part of the header that depends on who is signed in. Rendered inside <Suspense>. `onPhoto`: white, for the homepage hero. */
export async function UserMenu({ onPhoto = false }: { onPhoto?: boolean } = {}) {
  const user = await getCurrentUser();
  const navLink = onPhoto ? photoLink : inkLink;
  if (!user) {
    return (
      <>
        <Link href="/login" className={navLink}>
          Log in
        </Link>
        {onPhoto ? <Link href="/signup" className={photoPill}>Sign up</Link> : <ButtonLink href="/signup">Sign up</ButtonLink>}
      </>
    );
  }
  return (
    <>
      <ModeSwitch current={null} isHost={user.roles.includes("OWNER")} onPhoto={onPhoto} />
      {user.roles.includes("PROVIDER") ? (
        <Link href="/provider" className={navLink}>
          Services
        </Link>
      ) : null}
      {user.roles.includes("ADMIN") ? (
        <Link href="/admin" className={navLink}>
          Admin
        </Link>
      ) : null}
      <form action={logout}>
        {onPhoto ? (
          <button type="submit" className={navLink}>Log out</button>
        ) : (
          <Button type="submit" variant="ghost">
            Log out
          </Button>
        )}
      </form>
      <Avatar name={user.name} />
    </>
  );
}

export function UserMenuFallback() {
  return <span className="inline-block h-11 w-40" aria-hidden="true" />;
}
