"use client";

import type {FormEvent} from "react";
import {useEffect, useState, useTransition} from "react";
import {useRouter} from "next/navigation";

import type {ApiErrorResponse, CommentCreate, CommentPage, CommentResponse, LikeActionResponse,} from "@/lib/types";
import LikerListModal from "@/components/feed/liker-list-modal";

type PostCommentsProps = {
    postId: string;
    onCommentCreated?: () => void;
};

function getInitials(fullName: string): string {
    return fullName
        .split(" ")
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
}

function formatRelativeTime(value: string): string {
    const target = new Date(value).getTime();
    const now = Date.now();
    const diffInSeconds = Math.round((target - now) / 1000);
    const absoluteSeconds = Math.abs(diffInSeconds);
    const formatter = new Intl.RelativeTimeFormat("en", {numeric: "auto"});

    if (absoluteSeconds < 60) return formatter.format(diffInSeconds, "second");

    const diffInMinutes = Math.round(diffInSeconds / 60);
    if (Math.abs(diffInMinutes) < 60) return formatter.format(diffInMinutes, "minute");

    const diffInHours = Math.round(diffInMinutes / 60);
    if (Math.abs(diffInHours) < 24) return formatter.format(diffInHours, "hour");

    const diffInDays = Math.round(diffInHours / 24);
    if (Math.abs(diffInDays) < 30) return formatter.format(diffInDays, "day");

    return new Date(value).toLocaleDateString();
}

async function getErrorMessage(response: Response): Promise<string> {
    try {
        const data = (await response.json()) as ApiErrorResponse;
        return data.detail || "Request failed.";
    } catch {
        return "Request failed.";
    }
}

function updateCommentTree(
    comments: CommentResponse[],
    targetId: string,
    updater: (comment: CommentResponse) => CommentResponse,
): CommentResponse[] {
    return comments.map((comment) => {
        if (comment.id === targetId) {
            return updater(comment);
        }

        return {
            ...comment,
            replies: comment.replies.map((reply) =>
                reply.id === targetId
                    ? {
                        ...reply,
                        like_count:
                        updater({
                            ...reply,
                            replies: [],
                        } as CommentResponse).like_count,
                        liked_by_me:
                        updater({
                            ...reply,
                            replies: [],
                        } as CommentResponse).liked_by_me,
                    }
                    : reply,
            ),
        };
    });
}

export default function PostComments({
                                         postId,
                                         onCommentCreated,
                                     }: PostCommentsProps) {
    const router = useRouter();
    const [isRedirecting, startTransition] = useTransition();

    const [comments, setComments] = useState<CommentResponse[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);

    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [newComment, setNewComment] = useState("");
    const [replyingToId, setReplyingToId] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState("");

    const [likerModal, setLikerModal] = useState<{
        isOpen: boolean;
        title: string;
        endpoint: string | null;
    }>({
        isOpen: false,
        title: "",
        endpoint: null,
    });

    async function handleUnauthorized() {
        startTransition(() => {
            router.replace("/login");
            router.refresh();
        });
    }

    async function loadComments(cursor?: string, append = false) {
        const searchParams = new URLSearchParams({limit: "10"});
        if (cursor) searchParams.set("cursor", cursor);

        const response = await fetch(`/api/proxy/posts/${postId}/comments?${searchParams}`, {
            method: "GET",
            cache: "no-store",
        });

        if (response.status === 401) {
            await handleUnauthorized();
            return;
        }

        if (!response.ok) throw new Error(await getErrorMessage(response));

        const data = (await response.json()) as CommentPage;
        setComments((current) => (append ? [...current, ...data.items] : data.items));
        setNextCursor(data.next_cursor);
        setHasMore(data.has_more);
    }

    useEffect(() => {
        async function run() {
            setError(null);
            setIsLoading(true);
            try {
                await loadComments();
            } catch (loadError) {
                setError(loadError instanceof Error ? loadError.message : "Unable to load comments.");
            } finally {
                setIsLoading(false);
            }
        }

        void run();
    }, [postId]);

    async function handleCreateComment(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        const content = newComment.trim();
        if (!content) return;

        setIsSubmittingComment(true);

        try {
            const payload: CommentCreate = {content, parent_id: null};

            const response = await fetch(`/api/proxy/posts/${postId}/comments`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(payload),
            });

            if (response.status === 401) {
                await handleUnauthorized();
                return;
            }

            if (!response.ok) throw new Error(await getErrorMessage(response));

            setNewComment("");
            await loadComments();
            onCommentCreated?.();
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "Unable to create comment.");
        } finally {
            setIsSubmittingComment(false);
        }
    }

    async function handleCreateReply(parentId: string) {
        setError(null);

        const content = replyContent.trim();
        if (!content) return;

        setIsSubmittingReply(true);

        try {
            const payload: CommentCreate = {content, parent_id: parentId};

            const response = await fetch(`/api/proxy/posts/${postId}/comments`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(payload),
            });

            if (response.status === 401) {
                await handleUnauthorized();
                return;
            }

            if (!response.ok) throw new Error(await getErrorMessage(response));

            setReplyContent("");
            setReplyingToId(null);
            await loadComments();
            onCommentCreated?.();
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "Unable to create reply.");
        } finally {
            setIsSubmittingReply(false);
        }
    }

    async function handleToggleLike(commentId: string, liked: boolean) {
        setError(null);

        const response = await fetch(`/api/proxy/comments/${commentId}/like`, {
            method: liked ? "DELETE" : "POST",
        });

        if (response.status === 401) {
            await handleUnauthorized();
            return;
        }

        if (!response.ok) {
            setError(await getErrorMessage(response));
            return;
        }

        const result = (await response.json()) as LikeActionResponse;

        setComments((current) =>
            updateCommentTree(current, commentId, (comment) => ({
                ...comment,
                liked_by_me: result.liked,
                like_count: result.count,
            })),
        );
    }

    async function handleLoadMore() {
        if (!nextCursor) return;

        setError(null);
        setIsLoadingMore(true);

        try {
            await loadComments(nextCursor, true);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Unable to load more comments.");
        } finally {
            setIsLoadingMore(false);
        }
    }

    return (
        <div className="mt-4 border-top pt-4">
            <form onSubmit={handleCreateComment} className="_mar_b24">
                <div className="d-flex gap-3">
          <textarea
              className="form-control _comment_textarea"
              placeholder="Write a comment"
              value={newComment}
              onChange={(event) => setNewComment(event.target.value)}
              disabled={isSubmittingComment || isRedirecting}
              required
          />
                    <button
                        type="submit"
                        disabled={isSubmittingComment || isRedirecting}
                        className="_feed_inner_text_area_btn_link"
                    >
                        <span>{isSubmittingComment ? "Posting..." : "Comment"}</span>
                    </button>
                </div>
            </form>

            {error ? <div className="alert alert-danger _mar_b16">{error}</div> : null}
            {isLoading ? <p className="text-sm text-slate-500">Loading comments...</p> : null}
            {!isLoading && comments.length === 0 ? (
                <p className="text-sm text-slate-500">No comments yet.</p>
            ) : null}

            <div className="space-y-4">
                {comments.map((comment) => (
                    <div key={comment.id} className="rounded-4 border border-slate-200 bg-slate-50 p-4">
                        <div className="d-flex gap-3">
                            <div
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#377DFF] text-xs font-semibold text-white">
                                {getInitials(comment.author.full_name)}
                            </div>

                            <div className="w-100">
                                <div className="d-flex flex-wrap items-center gap-2">
                                    <p className="mb-0 text-sm font-semibold text-slate-900">{comment.author.full_name}</p>
                                    <span className="text-xs text-slate-500">{formatRelativeTime(comment.created_at)}</span>
                                </div>

                                <p className="mt-2 mb-2 whitespace-pre-line text-sm leading-7 text-slate-700">
                                    {comment.content}
                                </p>

                                {/*<div className="d-flex gap-3">
                                    <button
                                        type="button"
                                        className="border-0 bg-transparent p-0 text-sm font-medium text-[#377DFF]"
                                        onClick={() => void handleToggleLike(comment.id, comment.liked_by_me)}
                                    >
                                        {comment.liked_by_me ? `Unlike (${comment.like_count})` : `Like (${comment.like_count})`}
                                    </button>

                                    <button
                                        type="button"
                                        className="border-0 bg-transparent p-0 text-sm font-medium text-[#377DFF]"
                                        onClick={() => {
                                            if (replyingToId === comment.id) {
                                                setReplyingToId(null);
                                                setReplyContent("");
                                            } else {
                                                setReplyingToId(comment.id);
                                                setReplyContent("");
                                            }
                                        }}
                                    >
                                        {replyingToId === comment.id ? "Cancel reply" : "Reply"}
                                    </button>
                                </div>*/}

                                <div className="d-flex gap-3">
                                    <button
                                        type="button"
                                        className="border-0 bg-transparent p-0 text-sm font-medium text-[#377DFF]"
                                        onClick={() => void handleToggleLike(comment.id, comment.liked_by_me)}
                                    >
                                        {comment.liked_by_me ? "Unlike" : "Like"}
                                    </button>

                                    <button
                                        type="button"
                                        className="border-0 bg-transparent p-0 text-sm text-slate-500"
                                        onClick={() =>
                                            setLikerModal({
                                                isOpen: true,
                                                title: "People who liked this comment",
                                                endpoint: `/api/proxy/comments/${comment.id}/likes`,
                                            })
                                        }
                                    >
                                        {comment.like_count} likes
                                    </button>

                                    <button
                                        type="button"
                                        className="border-0 bg-transparent p-0 text-sm font-medium text-[#377DFF]"
                                        onClick={() => {
                                            if (replyingToId === comment.id) {
                                                setReplyingToId(null);
                                                setReplyContent("");
                                            } else {
                                                setReplyingToId(comment.id);
                                                setReplyContent("");
                                            }
                                        }}
                                    >
                                        {replyingToId === comment.id ? "Cancel reply" : "Reply"}
                                    </button>
                                </div>

                                {replyingToId === comment.id ? (
                                    <div className="mt-3">
                                        <textarea
                                            className="form-control _comment_textarea"
                                            placeholder={`Reply to ${comment.author.first_name}`}
                                            value={replyContent}
                                            onChange={(event) => setReplyContent(event.target.value)}
                                            disabled={isSubmittingReply || isRedirecting}
                                        />
                                        <div className="mt-3 d-flex justify-content-end">
                                            <button
                                                type="button"
                                                disabled={isSubmittingReply || isRedirecting}
                                                className="_feed_inner_text_area_btn_link"
                                                onClick={() => void handleCreateReply(comment.id)}
                                            >
                                                <span>{isSubmittingReply ? "Replying..." : "Reply"}</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : null}

                                {comment.replies.length > 0 ? (
                                    <div className="mt-4 space-y-3">
                                        {comment.replies.map((reply) => (
                                            <div key={reply.id} className="rounded-4 border border-slate-200 bg-white p-3">
                                                <div className="d-flex gap-3">
                                                    <div
                                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                                                        {getInitials(reply.author.full_name)}
                                                    </div>

                                                    <div className="w-100">
                                                        <div className="d-flex flex-wrap items-center gap-2">
                                                            <p className="mb-0 text-sm font-semibold text-slate-900">{reply.author.full_name}</p>
                                                            <span className="text-xs text-slate-500">{formatRelativeTime(reply.created_at)}</span>
                                                        </div>

                                                        <p className="mt-2 mb-2 whitespace-pre-line text-sm leading-7 text-slate-700">
                                                            {reply.content}
                                                        </p>

                                                        {/*<button
                                                            type="button"
                                                            className="border-0 bg-transparent p-0 text-sm font-medium text-[#377DFF]"
                                                            onClick={() => void handleToggleLike(reply.id, reply.liked_by_me)}
                                                        >
                                                            {reply.liked_by_me ? `Unlike (${reply.like_count})` : `Like (${reply.like_count})`}
                                                        </button>*/}
                                                        <div className="d-flex gap-3">
                                                            <button
                                                                type="button"
                                                                className="border-0 bg-transparent p-0 text-sm font-medium text-[#377DFF]"
                                                                onClick={() => void handleToggleLike(reply.id, reply.liked_by_me)}
                                                            >
                                                                {reply.liked_by_me ? "Unlike" : "Like"}
                                                            </button>

                                                            <button
                                                                type="button"
                                                                className="border-0 bg-transparent p-0 text-sm text-slate-500"
                                                                onClick={() =>
                                                                    setLikerModal({
                                                                        isOpen: true,
                                                                        title: "People who liked this reply",
                                                                        endpoint: `/api/proxy/comments/${reply.id}/likes`,
                                                                    })
                                                                }
                                                            >
                                                                {reply.like_count} likes
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {hasMore ? (
                <div className="mt-4 d-flex justify-content-center">
                    <button
                        type="button"
                        disabled={isLoadingMore}
                        className="_feed_inner_text_area_btn_link"
                        onClick={() => void handleLoadMore()}
                    >
                        <span>{isLoadingMore ? "Loading..." : "Load more comments"}</span>
                    </button>
                </div>
            ) : null}
            <LikerListModal
                isOpen={likerModal.isOpen}
                title={likerModal.title}
                endpoint={likerModal.endpoint}
                onClose={() =>
                    setLikerModal({
                        isOpen: false,
                        title: "",
                        endpoint: null,
                    })
                }
            />
        </div>
    );
}
