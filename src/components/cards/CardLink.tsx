import type { LinkCard } from '@/core/types'
import { useLinkPreview } from '@/core/hooks'
import { YouTubeEmbed } from '../embeds/YouTubeEmbed'
import { TwitterEmbed } from '../embeds/TwitterEmbed'

interface CardLinkProps {
  card: LinkCard
}

export function CardLink({ card }: CardLinkProps) {
  const { title, subtitle, hostname } = useLinkPreview(card)

  if (card.embedType === 'youtube' && card.embedData?.videoId) {
    return <YouTubeEmbed videoId={card.embedData.videoId as string} />
  }

  if (card.embedType === 'twitter' && card.embedData?.tweetId) {
    return <TwitterEmbed tweetId={card.embedData.tweetId as string} />
  }

  if (card.preview?.image) {
    return (
      <img
        src={card.preview.image}
        alt={title || 'Link preview'}
        className="w-full aspect-video object-cover"
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
    )
  }

  return (
    <div className="aspect-video bg-gradient-to-br from-[#0f172a] to-[#1e293b] flex items-end p-3">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/60 font-semibold mb-1">
          {subtitle || hostname}
        </p>
        <p className="text-sm text-white font-medium leading-snug line-clamp-2">
          {title}
        </p>
      </div>
    </div>
  )
}
