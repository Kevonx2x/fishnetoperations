import { cn } from "@/lib/utils";

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[#2C2C2C]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

type ArticleBodyProps = {
  body: string;
  className?: string;
};

/** Simple markdown-lite: paragraphs + **bold** lines. */
export function ArticleBody({ body, className }: ArticleBodyProps) {
  const blocks = body.trim().split(/\n\n+/).filter(Boolean);

  return (
    <div className={cn("space-y-4 text-[15px] leading-relaxed text-[#2C2C2C]/80", className)}>
      {blocks.map((block, index) => (
        <p key={index}>{renderInline(block.replace(/\n/g, " "))}</p>
      ))}
    </div>
  );
}
