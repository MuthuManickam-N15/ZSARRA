import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page page-enter py-28 text-center">
      <h1 className="text-2xl font-bold md:text-3xl">Page not found</h1>
      <p className="mt-4">The page you asked for doesn't exist or has moved.</p>
      <Link href="/" className="btn-primary mt-8">Back to home</Link>
    </div>
  );
}
