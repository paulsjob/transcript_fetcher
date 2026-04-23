function LayoutShell({ children }) {
  return (
    <div className="min-h-screen bg-background px-2 py-3 font-body text-body text-text sm:px-3">
      <main className="mx-auto grid w-full max-w-layout grid-cols-12 gap-2">{children}</main>
    </div>
  );
}

export default LayoutShell;
