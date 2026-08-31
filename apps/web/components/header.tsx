"use client";
import { LogOut, Menu, User } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type HeaderProps = {
  user: { firstName: string; lastName: string; email?: string; profileImage?: string };
  onToggleSidebar?: () => void;
};

export default function Header({ user, onToggleSidebar }: HeaderProps) {
  const router = useRouter();

  const initials =
    `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() ||
    "?";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="flex items-center bg-green-700 text-white h-14 px-4 gap-4" style={{ paddingTop: "env(safe-area-inset-top)", height: "calc(3.5rem + env(safe-area-inset-top))" }}>
      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          className="hidden md:flex items-center justify-center rounded p-1 -ml-1 transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Menu size={22} className="text-white" />
        </button>
      )}
      <Image
        src="/GolfChallengePoint_Logo_Inv_48x48.png"
        alt="Golf Challenge Point Logo"
        width={40}
        height={40}
        priority
        className="ml-1"
      />
      <span className="text-lg font-bold">Golf Challenge Point</span>
      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 outline-none"
              aria-label="User menu"
            >
              <Avatar className="h-8 w-8 border-2 border-white/50">
                {user.profileImage && (
                  <AvatarImage src={user.profileImage} alt={`${user.firstName} ${user.lastName}`} />
                )}
                <AvatarFallback className="bg-green-800 text-white text-xs font-semibold">
                  {initials === "?" ? <User size={14} /> : initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm hidden sm:block">
                {user.firstName} {user.lastName}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <p className="font-medium text-sm">
                {user.firstName} {user.lastName}
              </p>
              {user.email && (
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings/personal")}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
