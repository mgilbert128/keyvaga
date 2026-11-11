import { Chip } from "@/components/ui/Card";

export function BookingStatusChip({ status, checkIn, checkOut, today }: { status: string; checkIn: Date; checkOut: Date; today: Date }) {
  if (status === "CANCELLED") return <Chip tone="warn">Cancelled</Chip>;
  if (status === "PENDING_PAYMENT") return <Chip tone="warn">Awaiting payment</Chip>;
  if (checkOut <= today) return <Chip>Completed</Chip>;
  if (checkIn <= today) return <Chip>Staying now</Chip>;
  const days = Math.round((checkIn.getTime() - today.getTime()) / 86_400_000);
  return <Chip>Upcoming · in {days} day{days === 1 ? "" : "s"}</Chip>;
}
