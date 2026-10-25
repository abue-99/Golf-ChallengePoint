import { Suspense } from "react";
import MessagesView from "@/components/messages/MessagesView";

export const metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesView />
    </Suspense>
  );
}
