export type Room = {
  id: string;
  slug: string;
  owner_id: string;
  title: string;
  visibility: "private" | "link";
  created_at: string;
};

export type Message = {
  id: string;
  room_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
