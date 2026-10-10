export type PadKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "del" | "ok";

export function padReducer(state: string, key: PadKey): { entry: string; submit?: number } {
  if (key === "del") return { entry: state.slice(0, -1) };
  if (key === "ok") {
    if (state === "") return { entry: "" };
    return { entry: "", submit: Number(state) };
  }
  if (state.length >= 3) return { entry: state };
  if (state === "0") return { entry: key };
  return { entry: state + key };
}
