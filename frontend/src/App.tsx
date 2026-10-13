// Temporary setup screen — replaced by the router + AppShell in the frontend phase.
export default function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-4 px-5 py-8">
      <h1 className="font-display text-title font-bold">Same Pinch</h1>
      <p className="text-ink-muted">Setup check: tokens, fonts and Tailwind are wired.</p>
      <section className="rounded-card bg-night p-6 text-white shadow-night">
        <span className="font-display text-numeral font-bold text-pinch">7</span>
        <p className="font-display text-section font-bold">Day flame</p>
      </section>
      <button className="h-14 rounded-full bg-brand font-semibold text-white shadow-float">Play 10 rounds</button>
    </main>
  );
}
