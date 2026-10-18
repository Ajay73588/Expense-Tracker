import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-dark text-white p-6">
      <div className="text-center space-y-4 max-w-md">
        <h2 className="text-4xl font-bold text-brand-400">404</h2>
        <h3 className="text-xl font-semibold">Page Not Found</h3>
        <p className="text-sm text-gray-400">
          The requested financial resource or page could not be located.
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-5 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
