"use client";

import {ChangeEvent, FormEvent, useCallback, useEffect, useState, useTransition} from "react";
import {useRouter} from "next/navigation";
import Image from "next/image";

import LogoutButton from "@/components/feed/logout-button";
import PostComments from "@/components/feed/post-comments";
import ProfileSummaryCard from "@/components/feed/profile-summary-card";
import type {
    ApiErrorResponse,
    LikeActionResponse,
    PostCreate,
    PostFeedPage,
    PostResponse,
    UploadedImageResponse,
    UserResponse,
    Visibility,
} from "@/lib/types";
import LikerListModal from "@/components/feed/liker-list-modal";

type FeedClientProps = {
    currentUser: UserResponse;
};

type ComposerState = {
    content: string;
    image_url: string;
    visibility: Visibility;
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

export default function FeedClient({currentUser}: FeedClientProps) {
    const router = useRouter();
    const [isRedirecting, startTransition] = useTransition();

    const [posts, setPosts] = useState<PostResponse[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [openComments, setOpenComments] = useState<Record<string, boolean>>({});

    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    const [feedError, setFeedError] = useState<string | null>(null);
    const [composerError, setComposerError] = useState<string | null>(null);

    const [composer, setComposer] = useState<ComposerState>({
        content: "",
        image_url: "",
        visibility: "public",
    });

    const [likerModal, setLikerModal] = useState<{
        isOpen: boolean;
        title: string;
        endpoint: string | null;
    }>({
        isOpen: false,
        title: "",
        endpoint: null,
    });

    const initials = getInitials(currentUser.full_name);
    const isBusy = isCreating || isRedirecting || isUploadingImage;

    const handleUnauthorized = useCallback(async () => {
        startTransition(() => {
            router.replace("/login");
            router.refresh();
        });
    }, [router, startTransition]);

    const loadPosts = useCallback(async (cursor?: string, append = false) => {
        const searchParams = new URLSearchParams({limit: "10"});
        if (cursor) searchParams.set("cursor", cursor);

        const response = await fetch(`/api/proxy/posts?${searchParams}`, {
            method: "GET",
            cache: "no-store",
        });

        if (response.status === 401) {
            await handleUnauthorized();
            return;
        }

        if (!response.ok) throw new Error(await getErrorMessage(response));

        const data = (await response.json()) as PostFeedPage;
        setPosts((current) => (append ? [...current, ...data.items] : data.items));
        setNextCursor(data.next_cursor);
        setHasMore(data.has_more);
    }, [handleUnauthorized]);

    useEffect(() => {
        async function run() {
            setFeedError(null);
            setIsLoading(true);

            try {
                await loadPosts();
            } catch (error) {
                setFeedError(error instanceof Error ? error.message : "Unable to load posts.");
            } finally {
                setIsLoading(false);
            }
        }

        void run();
    }, [loadPosts]);

    async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        setComposerError(null);
        setIsUploadingImage(true);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch("/api/proxy/uploads/post-image", {
                method: "POST",
                body: formData,
            });

            if (response.status === 401) {
                await handleUnauthorized();
                return;
            }

            if (!response.ok) throw new Error(await getErrorMessage(response));

            const uploaded = (await response.json()) as UploadedImageResponse;

            setComposer((current) => ({
                ...current,
                image_url: uploaded.url,
            }));
        } catch (error) {
            setComposerError(error instanceof Error ? error.message : "Unable to upload image.");
        } finally {
            setIsUploadingImage(false);
            event.target.value = "";
        }
    }

    async function handleCreatePost(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setComposerError(null);

        const content = composer.content.trim();
        if (!content) {
            setComposerError("Post content is required.");
            return;
        }

        setIsCreating(true);

        try {
            const payload: PostCreate = {
                content,
                image_url: composer.image_url.trim() || null,
                visibility: composer.visibility,
            };

            const response = await fetch("/api/proxy/posts", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(payload),
            });

            if (response.status === 401) {
                await handleUnauthorized();
                return;
            }

            if (!response.ok) throw new Error(await getErrorMessage(response));

            const createdPost = (await response.json()) as PostResponse;

            setPosts((current) => [createdPost, ...current]);
            setComposer({
                content: "",
                image_url: "",
                visibility: "public",
            });
        } catch (error) {
            setComposerError(error instanceof Error ? error.message : "Unable to create post.");
        } finally {
            setIsCreating(false);
        }
    }

    async function handleTogglePostLike(postId: string, liked: boolean) {
        const response = await fetch(`/api/proxy/posts/${postId}/like`, {
            method: liked ? "DELETE" : "POST",
        });

        if (response.status === 401) {
            await handleUnauthorized();
            return;
        }

        if (!response.ok) {
            setFeedError(await getErrorMessage(response));
            return;
        }

        const result = (await response.json()) as LikeActionResponse;

        setPosts((current) =>
            current.map((post) =>
                post.id === postId
                    ? {
                        ...post,
                        liked_by_me: result.liked,
                        like_count: result.count,
                    }
                    : post,
            ),
        );
    }

    async function handleLoadMore() {
        if (!nextCursor) return;

        setFeedError(null);
        setIsLoadingMore(true);

        try {
            await loadPosts(nextCursor, true);
        } catch (error) {
            setFeedError(error instanceof Error ? error.message : "Unable to load more posts.");
        } finally {
            setIsLoadingMore(false);
        }
    }

    function toggleComments(postId: string) {
        setOpenComments((current) => ({
            ...current,
            [postId]: !current[postId],
        }));
    }

    function incrementCommentCount(postId: string) {
        setPosts((current) =>
            current.map((post) =>
                post.id === postId ? {...post, comment_count: post.comment_count + 1} : post,
            ),
        );
    }

    return (
        <div className="_layout _layout_main_wrapper">
            <div className="_main_layout">
                <nav className="navbar navbar-expand-lg navbar-light _header_nav _padd_t10">
                    <div className="container _custom_container">
                        <div className="_logo_wrap">
              <span className="navbar-brand">
                {/*<Image src="/assets/images/logo.svg" alt="Buddy Script" className="_nav_logo" width={100} height={100}/>*/}
                <img src="/assets/images/logo.svg" alt="Buddy Script" className="_nav_logo" width={100} height={100}/>
              </span>
                        </div>

                        <div className="ms-auto d-flex align-items-center gap-3">
                            <div className="hidden text-end md:block">
                                <p className="mb-0 text-sm font-semibold text-slate-900">{currentUser.full_name}</p>
                                <p className="mb-0 text-xs text-slate-500">{currentUser.email}</p>
                            </div>

                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#377DFF] text-sm font-semibold text-white">
                                {initials}
                            </div>

                            <LogoutButton/>
                        </div>
                    </div>
                </nav>

                <div className="container _custom_container">
                    <div className="_layout_inner_wrap">
                        <div className="row justify-content-center">
                            <div className="col-xl-7 col-lg-8 col-md-12 col-sm-12">
                                <div className="_layout_middle_wrap">
                                    <div className="_layout_middle_inner">
                                        <ProfileSummaryCard
                                            fullName={currentUser.full_name}
                                            email={currentUser.email}
                                            isActive={currentUser.is_active}
                                            createdAt={currentUser.created_at}
                                        />

                                        <form
                                            onSubmit={handleCreatePost}
                                            className="_feed_inner_text_area _b_radious6 _padd_b24 _padd_t24 _padd_r24 _padd_l24 _mar_b16"
                                        >
                                            <div className="_feed_inner_text_area_box">
                                                <div
                                                    className="mr-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#377DFF] text-sm font-semibold text-white">
                                                    {initials}
                                                </div>

                                                <div className="w-100">
                          <textarea
                              className="form-control _textarea"
                              placeholder="Write something ..."
                              value={composer.content}
                              onChange={(event) =>
                                  setComposer((current) => ({
                                      ...current,
                                      content: event.target.value,
                                  }))
                              }
                              disabled={isBusy}
                              required
                          />
                                                </div>
                                            </div>

                                            <div className="row _mar_t24">
                                                <div className="col-xl-5 col-lg-5 col-md-12 col-sm-12">
                                                    <input
                                                        type="url"
                                                        className="form-control _social_login_input"
                                                        placeholder="Optional image URL"
                                                        value={composer.image_url}
                                                        onChange={(event) =>
                                                            setComposer((current) => ({
                                                                ...current,
                                                                image_url: event.target.value,
                                                            }))
                                                        }
                                                        disabled={isBusy}
                                                    />
                                                </div>

                                                <div className="col-xl-3 col-lg-3 col-md-6 col-sm-12 mt-3 mt-lg-0">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        className="form-control _social_login_input"
                                                        onChange={(event) => void handleImageUpload(event)}
                                                        disabled={isBusy}
                                                    />
                                                </div>

                                                <div className="col-xl-2 col-lg-2 col-md-6 col-sm-12 mt-3 mt-lg-0">
                                                    <select
                                                        className="form-control _social_login_input"
                                                        value={composer.visibility}
                                                        onChange={(event) =>
                                                            setComposer((current) => ({
                                                                ...current,
                                                                visibility: event.target.value as Visibility,
                                                            }))
                                                        }
                                                        disabled={isBusy}
                                                    >
                                                        <option value="public">Public</option>
                                                        <option value="private">Private</option>
                                                    </select>
                                                </div>

                                                <div className="col-xl-2 col-lg-2 col-md-12 col-sm-12 mt-3 mt-lg-0">
                                                    <button
                                                        type="submit"
                                                        className="_feed_inner_text_area_btn_link w-100"
                                                        disabled={isBusy}
                                                    >
                            <span>
                              {isUploadingImage
                                  ? "Uploading..."
                                  : isCreating
                                      ? "Posting..."
                                      : "Post"}
                            </span>
                                                    </button>
                                                </div>
                                            </div>

                                            {composer.image_url ? (
                                                <p className="mt-3 mb-0 text-sm text-slate-500">Image attached.</p>
                                            ) : null}

                                            {composerError ? (
                                                <div className="alert alert-danger _mar_t20 _mar_b0">{composerError}</div>
                                            ) : null}
                                        </form>

                                        {feedError ? <div className="alert alert-danger _mar_b16">{feedError}</div> : null}

                                        {isLoading ? (
                                            <div className="_feed_inner_timeline_post_area _b_radious6 _padd_b24 _padd_t24 _mar_b16">
                                                <div className="_feed_inner_timeline_content _padd_r24 _padd_l24">
                                                    <p className="mb-0 text-sm text-slate-500">Loading posts...</p>
                                                </div>
                                            </div>
                                        ) : null}

                                        {!isLoading && posts.length === 0 ? (
                                            <div className="_feed_inner_timeline_post_area _b_radious6 _padd_b24 _padd_t24 _mar_b16">
                                                <div className="_feed_inner_timeline_content _padd_r24 _padd_l24">
                                                    <h4 className="_feed_inner_timeline_post_title">No posts yet</h4>
                                                    <p className="mt-3 mb-0 text-sm leading-7 text-slate-500">
                                                        Create your first post to start the feed.
                                                    </p>
                                                </div>
                                            </div>
                                        ) : null}

                                        {posts.map((post) => (
                                            <article
                                                key={post.id}
                                                className="_feed_inner_timeline_post_area _b_radious6 _padd_b24 _padd_t24 _mar_b16"
                                            >
                                                <div className="_feed_inner_timeline_content _padd_r24 _padd_l24">
                                                    <div className="_feed_inner_timeline_post_top">
                                                        <div className="_feed_inner_timeline_post_box">
                                                            <div
                                                                className="mr-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#377DFF] text-sm font-semibold text-white">
                                                                {getInitials(post.author.full_name)}
                                                            </div>

                                                            <div className="_feed_inner_timeline_post_box_txt">
                                                                <h4 className="_feed_inner_timeline_post_box_title">
                                                                    {post.author.full_name}
                                                                </h4>
                                                                <p className="_feed_inner_timeline_post_box_para">
                                                                    {formatRelativeTime(post.created_at)} .{" "}
                                                                    <span className="capitalize">{post.visibility}</span>
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <p className="mt-4 mb-0 whitespace-pre-line text-sm leading-7 text-slate-700">
                                                        {post.content}
                                                    </p>

                                                    {post.image_url ? (
                                                        <div className="_feed_inner_timeline_image _mar_t24">
                                                            {/*<Image src={post.image_url} alt="Post visual" className="_time_img" width={100} height={100}/>*/}
                                                            <img src={post.image_url} alt="Post visual" className="_time_img" width={100} height={100}/>
                                                        </div>
                                                    ) : null}
                                                </div>

                                                {/* <div className="_feed_inner_timeline_total_reacts _padd_r24 _padd_l24 _mar_b26">
                                                    <div className="text-sm text-slate-500">
                                                        <span className="mr-4">{post.like_count} likes</span>
                                                        <span>{post.comment_count} comments</span>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        className="border-0 bg-transparent p-0 text-sm font-medium text-[#377DFF]"
                                                        onClick={() => void handleTogglePostLike(post.id, post.liked_by_me)}
                                                    >
                                                        {post.liked_by_me ? "Unlike" : "Like"}
                                                    </button>
                                                </div>*/}

                                                <div className="_feed_inner_timeline_total_reacts _padd_r24 _padd_l24 _mar_b26">
                                                    <div className="d-flex items-center gap-3 text-sm text-slate-500">
                                                        <button
                                                            type="button"
                                                            className="border-0 bg-transparent p-0 text-sm text-slate-500"
                                                            onClick={() =>
                                                                setLikerModal({
                                                                    isOpen: true,
                                                                    title: "People who liked this post",
                                                                    endpoint: `/api/proxy/posts/${post.id}/likes`,
                                                                })
                                                            }
                                                        >
                                                            {post.like_count} likes
                                                        </button>

                                                        <span>{post.comment_count} comments</span>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        className="border-0 bg-transparent p-0 text-sm font-medium text-[#377DFF]"
                                                        onClick={() => void handleTogglePostLike(post.id, post.liked_by_me)}
                                                    >
                                                        {post.liked_by_me ? "Unlike" : "Like"}
                                                    </button>
                                                </div>

                                                <div className="_feed_inner_timeline_reaction">
                                                    <button
                                                        type="button"
                                                        className="_feed_inner_timeline_reaction_comment _feed_reaction"
                                                        onClick={() => toggleComments(post.id)}
                                                    >
                            <span className="_feed_inner_timeline_reaction_link">
                              {openComments[post.id] ? "Hide comments" : "View comments"}
                            </span>
                                                    </button>
                                                </div>

                                                {openComments[post.id] ? (
                                                    <div className="_padd_r24 _padd_l24">
                                                        <PostComments
                                                            postId={post.id}
                                                            onCommentCreated={() => incrementCommentCount(post.id)}
                                                        />
                                                    </div>
                                                ) : null}
                                            </article>
                                        ))}

                                        {hasMore ? (
                                            <div className="d-flex justify-content-center _mar_t24">
                                                <button
                                                    type="button"
                                                    onClick={() => void handleLoadMore()}
                                                    disabled={isLoadingMore}
                                                    className="_feed_inner_text_area_btn_link"
                                                >
                                                    <span>{isLoadingMore ? "Loading..." : "Load more"}</span>
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
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
