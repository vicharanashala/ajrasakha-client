// Displays the answer text exactly as written, keeping its original lines, bullets and numbering.
export default function AnswerContent({ answer }: { answer: string }) {
  return (
    <div className="whitespace-pre-line break-words text-sm leading-relaxed text-text-primary sm:text-base">
      {answer}
    </div>
  );
}
