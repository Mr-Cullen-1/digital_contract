import Link from "next/link";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="Vertex Contract — главная">
      <span className="brand-mark">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d="M3 5h5l4 9 4-9h5l-9 16L3 5Z" fill="currentColor" />
          <path d="m3 5 9 16-3-10L3 5Z" fill="white" fillOpacity=".28" />
        </svg>
      </span>
      {!compact && (
        <span>
          vertex<span className="brand-product">contract</span>
        </span>
      )}
    </Link>
  );
}
