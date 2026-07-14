"use client";

import type {FormEvent} from "react";
import {useCallback, useEffect, useState, useTransition} from "react";
import {useRouter} from "next/navigation";

import type {ApiErrorResponse, CommentCreate, CommentPage, CommentResponse, LikeActionResponse, UserResponse,} from "@/lib/types";
import LikerListModal from "@/components/feed/liker-list-modal";
import {Avatar} from "@/components/feed/Avatar";

type PostCommentsProps = {
    postId: string;
    currentUser: UserResponse;
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
                        like_count: updater({
                            ...reply,
                            replies: [],
                        } as CommentResponse).like_count,
                        liked_by_me: updater({
                            ...reply,
                            replies: [],
                        } as CommentResponse).liked_by_me,
                    }
                    : reply,
            ),
        };
    });
}

function ComposerAvatar({name}: { name: string }) {
    return (
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#377DFF] text-[10px] font-semibold uppercase text-white">
            {getInitials(name)}
        </div>
    );
}

function CommentAvatar({name}: { name: string }) {
    return (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-[#377DFF] text-xs font-semibold uppercase text-white">
            {getInitials(name)}
        </div>
    );
}

export default function PostComments({
                                         postId,
                                         currentUser,
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

    const handleUnauthorized = useCallback(async () => {
        startTransition(() => {
            router.replace("/login");
            router.refresh();
        });
    }, [router, startTransition]);

    const loadComments = useCallback(async (cursor?: string, append = false) => {
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
    }, [handleUnauthorized, postId]);

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
    }, [loadComments]);

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
        <>
            <form onSubmit={handleCreateComment} className="_feed_inner_comment_box">
                <div className="_feed_inner_comment_box_form">
                    <div className="_feed_inner_comment_box_content">
                        <div className="_feed_inner_comment_box_content_image">
                            <Avatar
                                name={currentUser.full_name}
                                imageUrl={currentUser.profile_image_url}
                                sizeClassName={"h-6.5 w-6.5"}
                                textClassName={"text-xs"}
                            />
                        </div>

                        <div className="_feed_inner_comment_box_content_txt">
                            <textarea
                                className="form-control _comment_textarea"
                                placeholder="Write a comment"
                                value={newComment}
                                onChange={(event) => setNewComment(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" && !event.shiftKey) {
                                        event.preventDefault();
                                        event.currentTarget.form?.requestSubmit();
                                    }
                                }}
                                disabled={isSubmittingComment || isRedirecting}
                                rows={1}
                                required
                            />
                        </div>
                    </div>

                    <div className="ml-3 flex shrink-0 items-center">
                        <button
                            type="button"
                            className="_feed_inner_comment_box_icon_btn"
                            disabled
                            aria-label="Voice comment unavailable"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16">
                                <path fill="#000" fillOpacity=".46" fillRule="evenodd"
                                      d="M13.167 6.534a.5.5 0 01.5.5c0 3.061-2.35 5.582-5.333 5.837V14.5a.5.5 0 01-1 0v-1.629C4.35 12.616 2 10.096 2 7.034a.5.5 0 011 0c0 2.679 2.168 4.859 4.833 4.859 2.666 0 4.834-2.18 4.834-4.86a.5.5 0 01.5-.5zM7.833.667a3.218 3.218 0 013.208 3.22v3.126c0 1.775-1.439 3.22-3.208 3.22a3.218 3.218 0 01-3.208-3.22V3.887c0-1.776 1.44-3.22 3.208-3.22zm0 1a2.217 2.217 0 00-2.208 2.22v3.126c0 1.223.991 2.22 2.208 2.22a2.217 2.217 0 002.208-2.22V3.887c0-1.224-.99-2.22-2.208-2.22z"
                                      clipRule="evenodd"/>
                            </svg>
                        </button>

                        <button
                            type="button"
                            className="_feed_inner_comment_box_icon_btn"
                            disabled
                            aria-label="Image comment unavailable"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16">
                                <path fill="#000" fillOpacity=".46" fillRule="evenodd"
                                      d="M10.867 1.333c2.257 0 3.774 1.581 3.774 3.933v5.435c0 2.352-1.517 3.932-3.774 3.932H5.101c-2.254 0-3.767-1.58-3.767-3.932V5.266c0-2.352 1.513-3.933 3.767-3.933h5.766zm0 1H5.101c-1.681 0-2.767 1.152-2.767 2.933v5.435c0 1.782 1.086 2.932 2.767 2.932h5.766c1.685 0 2.774-1.15 2.774-2.932V5.266c0-1.781-1.089-2.933-2.774-2.933zm.426 5.733l.017.015.013.013.009.008.037.037c.12.12.453.46 1.443 1.477a.5.5 0 11-.716.697S10.73 8.91 10.633 8.816a.614.614 0 00-.433-.118.622.622 0 00-.421.225c-1.55 1.88-1.568 1.897-1.594 1.922a1.456 1.456 0 01-2.057-.021s-.62-.63-.63-.642c-.155-.143-.43-.134-.594.04l-1.02 1.076a.498.498 0 01-.707.018.499.499 0 01-.018-.706l1.018-1.075c.54-.573 1.45-.6 2.025-.06l.639.647c.178.18.467.184.646.008l1.519-1.843a1.618 1.618 0 011.098-.584c.433-.038.854.088 1.19.363zM5.706 4.42c.921 0 1.67.75 1.67 1.67 0 .92-.75 1.67-1.67 1.67-.92 0-1.67-.75-1.67-1.67 0-.921.75-1.67 1.67-1.67zm0 1a.67.67 0 10.001 1.34.67.67 0 00-.002-1.34z"
                                      clipRule="evenodd"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <button type="submit" className="sr-only">
                    Comment
                </button>
            </form>

            {error ? <div className="alert alert-danger _mar_t16 _mar_b16">{error}</div> : null}
            {isLoading ? <p className="mt-3 mb-0 text-sm text-slate-500">Loading comments...</p> : null}
            {!isLoading && comments.length === 0 ? (
                <p className="mt-3 mb-0 text-sm text-slate-500">No comments yet.</p>
            ) : null}

            {!isLoading && comments.length > 0 ? (
                <div className="_timline_comment_main">
                    {hasMore ? (
                        <div className="_previous_comment">
                            <button
                                type="button"
                                className="_previous_comment_txt"
                                disabled={isLoadingMore}
                                onClick={() => void handleLoadMore()}
                            >
                                {isLoadingMore ? "Loading comments..." : "View previous comments"}
                            </button>
                        </div>
                    ) : null}

                    <div className="space-y-6">
                        {comments.map((comment) => (
                            <div key={comment.id}>
                                <div className="_comment_main">
                                    <div className="_comment_image">
                                        <Avatar name={comment.author.full_name}
                                                imageUrl={comment.author.profile_image_url}
                                                sizeClassName={"h-10 w-10"}
                                                textClassName={"text-xs"}/>/
                                    </div>

                                    <div className="_comment_area">
                                        <div
                                            className="_comment_details"
                                            style={{
                                                maxWidth: "100%",
                                                marginBottom: comment.like_count > 0 ? "50px" : "38px",
                                            }}
                                        >
                                            <div className="_comment_details_top">
                                                <div className="_comment_name">
                                                    <h4 className="_comment_name_title mb-0">
                                                        {comment.author.full_name}
                                                    </h4>
                                                </div>
                                            </div>

                                            <div className="_comment_status">
                                                <p className="_comment_status_text mb-0">
                                                    <span>{comment.content}</span>
                                                </p>
                                            </div>

                                            {comment.like_count > 0 ? (
                                                <button
                                                    type="button"
                                                    className="_total_reactions border-0"
                                                    onClick={() =>
                                                        setLikerModal({
                                                            isOpen: true,
                                                            title: "People who liked this comment",
                                                            endpoint: `/api/proxy/comments/${comment.id}/likes`,
                                                        })
                                                    }
                                                >
                                                    <div className="_total_react">
                                                        <span className="_reaction_like">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                                                                 fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                                                 strokeLinejoin="round">
                                                                <path
                                                                    d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                                                            </svg>
                                                        </span>
                                                        <span className="_reaction_heart">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                                                                 fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                                                 strokeLinejoin="round">
                                                                <path
                                                                    d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                                                            </svg>
                                                        </span>
                                                    </div>
                                                    <span className="_total">{comment.like_count}</span>
                                                </button>
                                            ) : null}

                                            <div className="_comment_reply">
                                                <div className="_comment_reply_num">
                                                    <ul className="_comment_reply_list list-unstyled mb-0">
                                                        <li>
                                                            <button
                                                                type="button"
                                                                className="border-0 bg-transparent p-0"
                                                                onClick={() => void handleToggleLike(comment.id, comment.liked_by_me)}
                                                            >
                                                                <span style={comment.liked_by_me ? {color: "#377DFF"} : undefined}>
                                                                    {comment.liked_by_me ? "Liked." : "Like."}
                                                                </span>
                                                            </button>
                                                        </li>

                                                        <li>
                                                            <button
                                                                type="button"
                                                                className="border-0 bg-transparent p-0"
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
                                                                <span>{replyingToId === comment.id ? "Cancel." : "Reply."}</span>
                                                            </button>
                                                        </li>

                                                        <li>
                                                            <button
                                                                type="button"
                                                                className="border-0 bg-transparent p-0"
                                                            >
                                                                <span>Share.</span>
                                                            </button>
                                                        </li>

                                                        <li>
                                                            <span className="_time_link">.{formatRelativeTime(comment.created_at)}</span>
                                                        </li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>

                                        {replyingToId === comment.id ? (
                                            <form
                                                className="mt-3"
                                                onSubmit={(event) => {
                                                    event.preventDefault();
                                                    void handleCreateReply(comment.id);
                                                }}
                                            >
                                                <div className="_feed_inner_comment_box">
                                                    <div className="_feed_inner_comment_box_form">
                                                        <div className="_feed_inner_comment_box_content">
                                                            <div className="_feed_inner_comment_box_content_image">
                                                                <ComposerAvatar name={currentUser.full_name}/>
                                                                {/*<Avatar
                                                                    name={currentUser.full_name}
                                                                    imageUrl={currentUser.profile_image_url}
                                                                    sizeClassName={"h-10 w-10"}
                                                                    textClassName={"text-xs"}
                                                                />*/}
                                                            </div>

                                                            <div className="_feed_inner_comment_box_content_txt">
                                                                <textarea
                                                                    className="form-control _comment_textarea"
                                                                    placeholder={`Reply to ${comment.author.first_name}`}
                                                                    value={replyContent}
                                                                    onChange={(event) => setReplyContent(event.target.value)}
                                                                    onKeyDown={(event) => {
                                                                        if (event.key === "Enter" && !event.shiftKey) {
                                                                            event.preventDefault();
                                                                            event.currentTarget.form?.requestSubmit();
                                                                        }
                                                                    }}
                                                                    disabled={isSubmittingReply || isRedirecting}
                                                                    rows={1}
                                                                    required
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="ml-3 flex shrink-0 items-center">
                                                            <button
                                                                type="button"
                                                                className="_feed_inner_comment_box_icon_btn"
                                                                disabled
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none"
                                                                     viewBox="0 0 16 16">
                                                                    <path fill="#000" fillOpacity=".46" fillRule="evenodd"
                                                                          d="M13.167 6.534a.5.5 0 01.5.5c0 3.061-2.35 5.582-5.333 5.837V14.5a.5.5 0 01-1 0v-1.629C4.35 12.616 2 10.096 2 7.034a.5.5 0 011 0c0 2.679 2.168 4.859 4.833 4.859 2.666 0 4.834-2.18 4.834-4.86a.5.5 0 01.5-.5zM7.833.667a3.218 3.218 0 013.208 3.22v3.126c0 1.775-1.439 3.22-3.208 3.22a3.218 3.218 0 01-3.208-3.22V3.887c0-1.776 1.44-3.22 3.208-3.22zm0 1a2.217 2.217 0 00-2.208 2.22v3.126c0 1.223.991 2.22 2.208 2.22a2.217 2.217 0 002.208-2.22V3.887c0-1.224-.99-2.22-2.208-2.22z"
                                                                          clipRule="evenodd"/>
                                                                </svg>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                className="_feed_inner_comment_box_icon_btn"
                                                                disabled
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none"
                                                                     viewBox="0 0 16 16">
                                                                    <path fill="#000" fillOpacity=".46" fillRule="evenodd"
                                                                          d="M10.867 1.333c2.257 0 3.774 1.581 3.774 3.933v5.435c0 2.352-1.517 3.932-3.774 3.932H5.101c-2.254 0-3.767-1.58-3.767-3.932V5.266c0-2.352 1.513-3.933 3.767-3.933h5.766zm0 1H5.101c-1.681 0-2.767 1.152-2.767 2.933v5.435c0 1.782 1.086 2.932 2.767 2.932h5.766c1.685 0 2.774-1.15 2.774-2.932V5.266c0-1.781-1.089-2.933-2.774-2.933zm.426 5.733l.017.015.013.013.009.008.037.037c.12.12.453.46 1.443 1.477a.5.5 0 11-.716.697S10.73 8.91 10.633 8.816a.614.614 0 00-.433-.118.622.622 0 00-.421.225c-1.55 1.88-1.568 1.897-1.594 1.922a1.456 1.456 0 01-2.057-.021s-.62-.63-.63-.642c-.155-.143-.43-.134-.594.04l-1.02 1.076a.498.498 0 01-.707.018.499.499 0 01-.018-.706l1.018-1.075c.54-.573 1.45-.6 2.025-.06l.639.647c.178.18.467.184.646.008l1.519-1.843a1.618 1.618 0 011.098-.584c.433-.038.854.088 1.19.363zM5.706 4.42c.921 0 1.67.75 1.67 1.67 0 .92-.75 1.67-1.67 1.67-.92 0-1.67-.75-1.67-1.67 0-.921.75-1.67 1.67-1.67zm0 1a.67.67 0 10.001 1.34.67.67 0 00-.002-1.34z"
                                                                          clipRule="evenodd"/>
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <button type="submit" className="sr-only">
                                                        Reply
                                                    </button>
                                                </div>
                                            </form>
                                        ) : null}

                                        {comment.replies.length > 0 ? (
                                            <div className="mt-4 ml-3 space-y-5">
                                                {comment.replies.map((reply) => (
                                                    <div key={reply.id} className="_comment_main">
                                                        <div className="_comment_image">
                                                            <Avatar
                                                                name={reply.author.full_name}
                                                                imageUrl={reply.author.profile_image_url}
                                                                sizeClassName={"h-10 w-10"}
                                                                textClassName={"text-xs"}
                                                            />
                                                        </div>

                                                        <div className="_comment_area">
                                                            <div
                                                                className="_comment_details"
                                                                style={{
                                                                    maxWidth: "100%",
                                                                    marginBottom: reply.like_count > 0 ? "50px" : "38px",
                                                                }}
                                                            >
                                                                <div className="_comment_details_top">
                                                                    <div className="_comment_name">
                                                                        <h4 className="_comment_name_title mb-0">
                                                                            {reply.author.full_name}
                                                                        </h4>
                                                                    </div>
                                                                </div>

                                                                <div className="_comment_status">
                                                                    <p className="_comment_status_text mb-0">
                                                                        <span>{reply.content}</span>
                                                                    </p>
                                                                </div>

                                                                {reply.like_count > 0 ? (
                                                                    <button
                                                                        type="button"
                                                                        className="_total_reactions border-0"
                                                                        onClick={() =>
                                                                            setLikerModal({
                                                                                isOpen: true,
                                                                                title: "People who liked this reply",
                                                                                endpoint: `/api/proxy/comments/${reply.id}/likes`,
                                                                            })
                                                                        }
                                                                    >
                                                                        <div className="_total_react">
                                                                            <span className="_reaction_like">
                                                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                                                                                     viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                                                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                                    <path
                                                                                        d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                                                                                </svg>
                                                                            </span>
                                                                            <span className="_reaction_heart">
                                                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                                                                                     viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                                                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                                    <path
                                                                                        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                                                                                </svg>
                                                                            </span>
                                                                        </div>
                                                                        <span className="_total">{reply.like_count}</span>
                                                                    </button>
                                                                ) : null}

                                                                <div className="_comment_reply">
                                                                    <div className="_comment_reply_num">
                                                                        <ul className="_comment_reply_list list-unstyled mb-0">
                                                                            <li>
                                                                                <button
                                                                                    type="button"
                                                                                    className="border-0 bg-transparent p-0"
                                                                                    onClick={() => void handleToggleLike(reply.id, reply.liked_by_me)}
                                                                                >
                                                                                    <span style={reply.liked_by_me ? {color: "#377DFF"} : undefined}>
                                                                                        {reply.liked_by_me ? "Liked." : "Like."}
                                                                                    </span>
                                                                                </button>
                                                                            </li>

                                                                            <li>
                                                                                <button
                                                                                    type="button"
                                                                                    className="border-0 bg-transparent p-0"
                                                                                >
                                                                                    <span>Share.</span>
                                                                                </button>
                                                                            </li>

                                                                            <li>
                                                                                <span
                                                                                    className="_time_link">.{formatRelativeTime(reply.created_at)}</span>
                                                                            </li>
                                                                        </ul>
                                                                    </div>
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
        </>
    );
}
