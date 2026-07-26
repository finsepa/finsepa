export type AgentThreadSummary = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type AgentStoredMessage = {
  id: string;
  thread_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  seq: number;
};
