import type { IslandMap as IslandMapData } from "@/domain/rewards/map";
import { IslandMap } from "../../rewards/IslandMap";
import { IndexCard } from "./IndexCard";

export function IslandsCard({ nickname, map }: { nickname: string; map: IslandMapData }) {
  return (
    <IndexCard color="var(--pp-white)">
      <h2>{nickname}'s islands</h2>
      <IslandMap map={map} size="full" animate={false} />
    </IndexCard>
  );
}
