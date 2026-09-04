export default function NotFound() {
  return (
    <main className="login">
      <section className="login-card">
        <h1 className="serif">Page not found</h1>
        <p>This page does not exist or is not available to your account.</p>
        <a className="button" href="/dashboard">
          Return to dashboard
        </a>
      </section>
    </main>
  );
}
