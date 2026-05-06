import { getYouTubeThumbnail } from '@/core/utils'

interface YouTubeEmbedProps {
  videoId: string
}

export function YouTubeEmbed({ videoId }: YouTubeEmbedProps) {
  const thumbnailUrl = getYouTubeThumbnail(videoId)

  return (
    <div className="relative group rounded overflow-hidden">
      <img
        src={thumbnailUrl}
        alt="YouTube video thumbnail"
        className="w-full aspect-video object-cover"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gradient-to-b from-[#ff6666] to-[#cc0000] text-white px-4 py-2 rounded shadow-y2k hover:from-[#ff7777] hover:to-[#dd1111] transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          ▶ Play
        </a>
      </div>
      <div className="absolute bottom-2 left-2 bg-gradient-to-b from-[#ff6666] to-[#cc0000] text-white px-2 py-0.5 text-xs rounded">
        📺 YouTube
      </div>
    </div>
  )
}
