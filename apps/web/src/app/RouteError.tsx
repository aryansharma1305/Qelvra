import { Link } from "react-router";
export function RouteError() {
  return (
    <main className="min-h-screen bg-background text-on-surface p-8 flex flex-col gap-4">
      <h1 className="text-headline-md font-headline-md">This page could not be opened</h1>
      <p>Your saved work is on the server. Retry this page, or return to Agents.</p>
      <button
        onClick={() => window.location.reload()}
        className="self-start px-4 py-2 rounded bg-primary text-on-primary"
      >
        Retry page
      </button>
      <Link to="/agents" className="underline">
        Open Agents
      </Link>
    </main>
  );
}
