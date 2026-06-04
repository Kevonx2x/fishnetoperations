export function TypingIndicator() {
  return (
    <div className="flex justify-start px-3 py-1" aria-label="Typing">
      <div className="flex items-center gap-1.5 rounded-[18px] rounded-bl-[4px] border border-[#2C2C2C]/8 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(44,44,44,0.04)]">
        <span className="bhg-typing-dot" />
        <span className="bhg-typing-dot bhg-typing-dot--delay-1" />
        <span className="bhg-typing-dot bhg-typing-dot--delay-2" />
      </div>
    </div>
  );
}
