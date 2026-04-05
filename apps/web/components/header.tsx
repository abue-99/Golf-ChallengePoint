
"use client";
import { Menu, X, LogOut, Settings, User } from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type HeaderProps = {
  user: { firstName: string; lastName: string };
  toggleSidebar: () => void;
  sidebarOpen: boolean;
};

export default function Header({ user, toggleSidebar, sidebarOpen }: HeaderProps) {
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
    <header className="flex items-center bg-green-700 text-white h-14 px-4 gap-4">
      <button
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        className="h-9 w-9 flex items-center justify-center rounded-md border-2 border-white/70 text-white hover:bg-white hover:text-green-700 transition-colors duration-200"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      <Image
        src="/GolfChallengePoint_Logo_Inv_48x48.png"
        alt="Golf Challenge Point Logo"
        width={40}
        height={40}
        priority
        className="ml-1"
      />
      <span className="font-bold text-lg">Golf Challenge Point</span>
      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 focus:outline-none rounded-full ring-offset-2 focus-visible:ring-2 focus-visible:ring-white"
              aria-label="User menu"
            >
              <Avatar className="h-8 w-8 border-2 border-white/50">
                <AvatarFallback className="bg-green-800 text-white text-xs font-semibold">
                  {initials === "?" ? <User size={14} /> : initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm hidden sm:block">
                {user.firstName} {user.lastName}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal">
              <p className="font-medium text-sm">
                {user.firstName} {user.lastName}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
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
