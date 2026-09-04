"use client";
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="login">
      <section className="login-card">
        <h1 className="serif">Something went wrong</h1>
        <p>{error.message || "The request could not be completed."}</p>
        <button className="button" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
