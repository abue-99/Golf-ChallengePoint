"use client";

import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CoachPlayerCard from "@/components/coach-game/CoachPlayerCard";
import {
  LearningProgressSection,
  type LearningProgressSummary,
} from "@/components/LearningProgress";
import { useState } from "react";

type CoachSummary = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
};

type ClubSummary = {
  clubId: string;
  club: { id: string; name: string } | null;
};

export type PlayerOverviewDialogPlayer = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  profileImage?: string | null;
  email?: string;
  phoneNumber?: string | null;
  timezone?: string | null;
  lastLogin?: string | null;
  userClubs?: ClubSummary[];
  coaches?: CoachSummary[];
  learningProgress?: LearningProgressSummary | null;
};

function playerName(player: PlayerOverviewDialogPlayer) {
  return (
    `${player.firstName ?? ""} ${player.lastName ?? ""}`.trim() ||
    player.email ||
    "—"
  );
}

function playerInitials(player: PlayerOverviewDialogPlayer) {
  return (
    `${player.firstName?.[0] ?? ""}${player.lastName?.[0] ?? ""}`.toUpperCase() ||
    "?"
  );
}

export default function PlayerOverviewDialog({
  player,
  onClose,
  onRemove,
  removeDisabled = false,
  removeLabel = "Remove from My Players",
}: {
  player: PlayerOverviewDialogPlayer;
  onClose: () => void;
  onRemove?: (playerId: string) => void | Promise<void>;
  removeDisabled?: boolean;
  removeLabel?: string;
}) {
  const isInactive = !player.lastLogin;
  const name = playerName(player);
  const router = useRouter();
  const [openingPlayerPage, setOpeningPlayerPage] = useState(false);

  async function handleRemove() {
    if (!onRemove) return;
    await onRemove(player.id);
  }

  function handleOpenPlayerPage() {
    setOpeningPlayerPage(true);
    router.push(`/coach/players/${player.id}`);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Player Overview</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 pt-2 lg:grid-cols-2">
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-24 w-24">
              {player.profileImage ? (
                <AvatarImage src={player.profileImage} alt={name} />
              ) : null}
              <AvatarFallback className="bg-gray-200 text-2xl text-gray-600">
                {playerInitials(player)}
              </AvatarFallback>
            </Avatar>

            {isInactive ? (
              <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-700">
                Inactive (pending activation)
              </span>
            ) : null}

            <div className="w-full space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium text-gray-500">Name</span>
                <span className="text-right">{name}</span>
              </div>
              {player.email ? (
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-gray-500">Email</span>
                  <span className="break-all text-right">{player.email}</span>
                </div>
              ) : null}
              {player.phoneNumber ? (
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-gray-500">Phone</span>
                  <span className="text-right">{player.phoneNumber}</span>
                </div>
              ) : null}
              {player.timezone ? (
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-gray-500">Timezone</span>
                  <span className="text-right">
                    {player.timezone.replace(/_/g, " ")}
                  </span>
                </div>
              ) : null}
              {player.userClubs?.length ? (
                <div className="flex justify-between gap-2">
                  <span className="shrink-0 font-medium text-gray-500">
                    Clubs
                  </span>
                  <span className="text-right">
                    {player.userClubs
                      .map((club) => club.club?.name ?? "")
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
              ) : null}
              {player.coaches?.length ? (
                <div className="flex justify-between gap-2">
                  <span className="shrink-0 font-medium text-gray-500">
                    Coaches
                  </span>
                  <span className="text-right">
                    {player.coaches
                      .map(
                        (coach) =>
                          `${coach.firstName ?? ""} ${coach.lastName ?? ""}`.trim() ||
                          coach.email ||
                          "",
                      )
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="w-full">
              <LearningProgressSection progress={player.learningProgress} />
            </div>

            <div className="mt-2 flex w-full flex-col gap-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleOpenPlayerPage}
                disabled={openingPlayerPage}
              >
                {openingPlayerPage ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Opening Player…
                  </>
                ) : (
                  <>
                    <ExternalLink size={16} className="mr-2" />
                    Go to Player
                  </>
                )}
              </Button>

              {onRemove ? (
                <Button
                  variant="destructive"
                  className="w-full gap-2"
                  onClick={handleRemove}
                  disabled={removeDisabled}
                >
                  <Trash2 size={16} />
                  {removeLabel}
                </Button>
              ) : null}
            </div>
          </div>

          <div>
            <CoachPlayerCard playerId={player.id} journeyHref={`/coach/players/${player.id}`} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
