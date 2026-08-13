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
    <div className="aspect-video bg-sunken flex items-end p-4">
      <div>
        <p className="text-xs text-text-faint mb-1.5">{subtitle || hostname}</p>
        <p className="text-base text-text leading-snug line-clamp-2">{title}</p>
      </div>
    </div>
  )
}
