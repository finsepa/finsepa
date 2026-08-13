/** Shared Apple / Google marks for auth CTAs. */

export function AppleMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M16.365 12.24c-.02-2.15 1.76-3.18 1.84-3.23-1-1.46-2.56-1.66-3.11-1.68-1.32-.13-2.58.78-3.25.78-.67 0-1.71-.76-2.81-.74-1.45.02-2.79.84-3.54 2.14-1.51 2.62-.39 6.5 1.08 8.63.72 1.04 1.58 2.2 2.71 2.16 1.09-.05 1.5-.7 2.81-.7 1.31 0 1.68.7 2.82.68 1.17-.02 1.91-1.05 2.62-2.1.83-1.2 1.17-2.36 1.19-2.42-.03-.01-2.28-.87-2.3-3.46zM14.7 5.88c.6-.73 1-1.74.89-2.75-.86.03-1.9.57-2.52 1.3-.55.64-1.04 1.67-.91 2.65 1.02.08 1.94-.52 2.54-1.2z" />
    </svg>
  );
}

export function GoogleMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.8-5.4 3.8-3.2 0-5.9-2.7-5.9-5.9S8.8 6.1 12 6.1c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.8 3.8 14.7 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.6-3.7 8.6-8.9 0-.6-.1-1-.1-1.4H12z"
      />
    </svg>
  );
}
