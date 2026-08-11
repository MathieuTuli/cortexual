import { Tweet } from 'react-tweet'
import 'react-tweet/theme.css'
import { ErrorBoundary } from '../ui'

interface TwitterEmbedProps {
  tweetId: string
}

export function TwitterEmbed({ tweetId }: TwitterEmbedProps) {
  const tweetUrl = `https://x.com/i/status/${tweetId}`

  const unavailable = (
    <div className="p-4 bg-white border border-[var(--color-border)] rounded-lg">
      <p className="text-sm font-medium text-[#1da1f2] mb-1">Tweet unavailable</p>
      <a
        href={tweetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent-primary hover:underline text-sm break-all"
      >
        Open on X →
      </a>
    </div>
  )

  return (
    <div
      className="twitter-embed not-prose [&_.react-tweet-theme]:!my-0"
      onClick={(e) => e.stopPropagation()}
    >
      <ErrorBoundary fallback={unavailable}>
        <Tweet
          id={tweetId}
          apiUrl={`/api/tweet/${tweetId}`}
          fallback={
            <div className="p-4 bg-white border border-[var(--color-border)] rounded-lg">
              <span className="text-sm font-medium text-[#1da1f2]">Loading tweet…</span>
            </div>
          }
          components={{ TweetNotFound: () => unavailable }}
        />
      </ErrorBoundary>
    </div>
  )
}
