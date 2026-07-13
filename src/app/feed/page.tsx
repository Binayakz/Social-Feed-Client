import FeedClient from "@/components/feed/feed-client";
import { requireCurrentUser } from "@/lib/session";

export default async function FeedPage() {
    const currentUser = await requireCurrentUser();

    return <FeedClient currentUser={currentUser} />;
}
