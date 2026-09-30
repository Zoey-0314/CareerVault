export interface CoachMessage {
  id: string;
  role: "coach" | "user";
  text: string;
}

interface Props {
  messages: CoachMessage[];
}

export function CoachTranscript({ messages }: Props) {
  if (!messages.length) return null;

  return (
    <div className="coachTranscript" aria-label="HR 顾问对话记录">
      {messages.slice(-8).map((message) => (
        <div className={`chatBubble ${message.role}`} key={message.id}>
          <span>{message.role === "coach" ? "HR" : "你"}</span>
          <p>{message.text}</p>
        </div>
      ))}
    </div>
  );
}
