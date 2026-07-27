"use client";

import { useEffect, useState } from "react";
import { PlayerCapabilitiesWidget } from "@/components/player-capabilities-widget";
import PlayerJourney from "@/components/PlayerJourney";

const DEFAULT_PLAYER_ID = "local-player";

export default function PlayerToday() {
  const [playerId, setPlayerId] = useState(DEFAULT_PLAYER_ID);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (me?.id) setPlayerId(String(me.id));
      })
      .catch((error) => {
        console.warn(
          "Failed to load current player identity for capabilities widget; using default profile.",
          error,
        );
      });
  }, []);

  return (
    <div className="space-y-6">
      <PlayerCapabilitiesWidget playerId={playerId} />
      <PlayerJourney />
    </div>
  );
}
