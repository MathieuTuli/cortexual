import type { LinkCard } from '@/core/types'
import { YouTubeEmbed } from '../embeds/YouTubeEmbed'
import { TwitterEmbed } from '../embeds/TwitterEmbed'

interface CardLinkProps {
  card: LinkCard
}

export function CardLink({ card }: CardLinkProps) {
  if (card.embedType === 'youtube' && card.embedData?.videoId) {
    return <YouTubeEmbed videoId={card.embedData.videoId as string} />
  }

  if (card.embedType === 'twitter' && card.embedData?.tweetId) {
    return <TwitterEmbed tweetId={card.embedData.tweetId as string} />
  }

  // For generic links, show preview without making the whole card a link
  // Users can open the link from the view modal
  return (
    <div className="block">
      {card.preview?.image && (
        <img
          src={card.preview.image}
          alt={card.preview.title || 'Link preview'}
          className="w-full aspect-video object-cover rounded mb-2"
        />
      )}
      <div className="space-y-1">
        {card.preview?.siteName && (
          <p className="text-xs text-accent-secondary font-medium">
            🔗 {card.preview.siteName}
          </p>
        )}
        <p className="text-sm font-medium text-text">
          {card.preview?.title || card.title || 'Link'}
        </p>
        {card.preview?.description && (
          <p className="text-xs text-text-muted line-clamp-2">
            {card.preview.description}
          </p>
        )}
        <p className="text-xs text-accent-primary truncate">
          {card.url}
        </p>
      </div>
    </div>
  )
}
