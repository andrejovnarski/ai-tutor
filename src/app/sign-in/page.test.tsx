import { renderToStaticMarkup } from "react-dom/server";
import { vi } from "vitest";
import { COVERS, TAGLINE } from "../about";

vi.mock("next/font/google", () => ({ Atkinson_Hyperlegible: () => ({ variable: "atk" }) }));
vi.mock("./actions", () => ({ requestLink: async () => {} }));
const { default: SignInPage } = await import("./page");

it("sign-in tells grown-ups what Nova teaches and lists the topics", async () => {
  const html = renderToStaticMarkup(await SignInPage({ searchParams: Promise.resolve({}) }));
  expect(html).toContain(TAGLINE);
  expect(html).toContain("Grown-ups sign in here.");
  expect(html).toContain(COVERS);
  expect(html).not.toContain("5 to 11");
});
