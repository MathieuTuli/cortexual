import { getYouTubeThumbnail } from '@/core/utils'

interface YouTubeEmbedProps {
  videoId: string
}

export function YouTubeEmbed({ videoId }: YouTubeEmbedProps) {
  const thumbnailUrl = getYouTubeThumbnail(videoId)

  return (
    <div className="relative group">
      <img
        src={thumbnailUrl}
        alt="YouTube video thumbnail"
        className="w-full aspect-video object-cover"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/15 group-hover:bg-black/25 transition-colors">
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-12 h-12 flex items-center justify-center rounded-full bg-bg/95 hover:bg-bg transition-colors shadow-float"
          onClick={(e) => e.stopPropagation()}
          aria-label="Play on YouTube"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-text ml-0.5">
            <path d="M6 4l14 8L6 20V4z" />
          </svg>
        </a>
      </div>
    </div>
  )
}
