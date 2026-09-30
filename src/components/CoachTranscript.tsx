import { BriefcaseBusiness, UserRound } from "lucide-react";

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
      {messages.slice(-8).map((item) => (
        <div className={`chatRow ${item.role}`} key={item.id}>
          <div className="chatIcon" aria-hidden="true">
            {item.role === "coach" ? <BriefcaseBusiness size={15} /> : <UserRound size={15} />}
          </div>
          <div className="chatBubble"><p>{item.text}</p></div>
        </div>
      ))}
    </div>
  );
}
