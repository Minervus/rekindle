import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function PersonAvatar({
  name,
  photoUrl,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
}) {
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className={cn("h-10 w-10 rounded-full object-cover shrink-0", className)} />;
  }

  return (
    <div
      className={cn(
        "h-10 w-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-sm font-medium shrink-0",
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}
