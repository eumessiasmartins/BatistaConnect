import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/timeline" });
  },
  head: () => ({
    meta: [
      { title: "Aurora — Comunicação Interna" },
      { name: "description", content: "Timeline, comunicados, eventos e enquetes da sua empresa." },
      { property: "og:title", content: "Aurora — Comunicação Interna" },
      { property: "og:description", content: "Timeline, comunicados, eventos e enquetes da sua empresa." },
    ],
  }),
});
