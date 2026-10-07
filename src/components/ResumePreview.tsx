import { resumePreviewBlocks } from '@/lib/resumeFormat'

export default function ResumePreview({ text }: { text: string }) {
  return (
    <div className="resumePreview">
      {resumePreviewBlocks(text).map((block, index) => {
        if (block.kind === 'gap') return <div className="resumeGap" key={index} />
        const children = block.parts.map((part, partIndex) => (
          part.bold ? <strong key={partIndex}>{part.text}</strong> : <span key={partIndex}>{part.text}</span>
        ))
        if (block.kind === 'heading') {
          const Tag = block.level === 1 ? 'h1' : 'h2'
          return <Tag key={index}>{children}</Tag>
        }
        if (block.kind === 'bullet') return <p className="resumeBullet" key={index}>{children}</p>
        return <p key={index}>{children}</p>
      })}
    </div>
  )
}
