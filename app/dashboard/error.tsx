'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Something went wrong!
        </h2>
        <p className="text-text-secondary mb-4">
          {error.message}
        </p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-accent text-text-primary rounded-md hover:bg-secondary"
        >
          Try again
        </button>
      </div>
    </div>
  )
} 