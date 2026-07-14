"use client";

import {ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState, useTransition} from "react";
import {useRouter} from "next/navigation";
import Image from "next/image";
import PostComments from "@/components/feed/post-comments";
import {FeedLeftSidebar, FeedRightSidebar, FeedStoriesRow} from "@/components/feed/feed-shell-sections";
import FeedNavbar from "@/components/feed/feed-navbar";
import type {ApiErrorResponse, LikeActionResponse, PostFeedPage, PostResponse, UserResponse, Visibility,} from "@/lib/types";
import LikerListModal from "@/components/feed/liker-list-modal";
import {Avatar} from "@/components/feed/Avatar";

type FeedClientProps = {
    currentUser: UserResponse;
};

type ComposerState = {
    content: string;
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
    // const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [composerImageFile, setComposerImageFile] = useState<File | null>(null);
    const [composerImagePreview, setComposerImagePreview] = useState<string | null>(null);

    const [feedError, setFeedError] = useState<string | null>(null);
    const [composerError, setComposerError] = useState<string | null>(null);

    const [composer, setComposer] = useState<ComposerState>({
        content: "",
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
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [showComposerExtras, setShowComposerExtras] = useState(false);

    const [openPostMenuId, setOpenPostMenuId] = useState<string | null>(null);

    const initials = getInitials(currentUser.full_name);
    // const isBusy = isCreating || isRedirecting || isUploadingImage;
    const isBusy = isCreating || isRedirecting;
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

    const [theme, setTheme] = useState<"light" | "dark">("light");
    const [isThemeReady, setIsThemeReady] = useState(false);

    useEffect(() => {
        const storedTheme = window.localStorage.getItem("buddy-theme");

        if (storedTheme === "dark" || storedTheme === "light") {
            setTheme(storedTheme);
        } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
            setTheme("dark");
        }

        setIsThemeReady(true);
    }, []);

    useEffect(() => {
        if (!isThemeReady) return;
        window.localStorage.setItem("buddy-theme", theme);
    }, [theme, isThemeReady]);

    function toggleTheme() {
        setTheme((current) => (current === "dark" ? "light" : "dark"));
    }

    const isDarkTheme = theme === "dark";

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
    useEffect(() => {
        return () => {
            if (composerImagePreview) {
                URL.revokeObjectURL(composerImagePreview);
            }
        };
    }, [composerImagePreview]);

    function handleImageSelect(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        setComposerError(null);

        if (!file.type.startsWith("image/")) {
            setComposerError("Please choose a valid image file.");
            event.target.value = "";
            return;
        }

        const previewUrl = URL.createObjectURL(file);

        setComposerImageFile(file);
        setComposerImagePreview(previewUrl);
        setShowComposerExtras(true);

        event.target.value = "";
    }

    function handleRemoveSelectedImage() {
        if (composerImagePreview) {
            URL.revokeObjectURL(composerImagePreview);
        }

        setComposerImageFile(null);
        setComposerImagePreview(null);
    }

    async function handleCreatePost(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setComposerError(null);

        const content = composer.content.trim();

        if (!content && !composerImageFile) {
            setComposerError("Write something or choose an image.");
            return;
        }

        setIsCreating(true);

        try {
            const formData = new FormData();

            if (content) {
                formData.append("content", content);
            }

            formData.append("visibility", composer.visibility);

            if (composerImageFile) {
                formData.append("image", composerImageFile);
            }

            const response = await fetch("/api/proxy/posts/compose", {
                method: "POST",
                body: formData,
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
                visibility: "public",
            });

            if (composerImagePreview) {
                URL.revokeObjectURL(composerImagePreview);
            }

            setComposerImageFile(null);
            setComposerImagePreview(null);
            setShowComposerExtras(false);
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
            current.map((post) => {
                if (post.id !== postId) {
                    return post;
                }

                const currentUserPreview = {
                    id: currentUser.id,
                    full_name: currentUser.full_name,
                    initials,
                    profile_image_url: currentUser.profile_image_url,
                };

                const nextPreview = result.liked
                    ? [currentUserPreview, ...post.likers_preview.filter((user) => user.id !== currentUser.id)].slice(0, 3)
                    : post.likers_preview.filter((user) => user.id !== currentUser.id);

                return {
                    ...post,
                    liked_by_me: result.liked,
                    like_count: result.count,
                    likers_preview: nextPreview,
                };
            }),
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

    function togglePostMenu(postId: string) {
        setOpenPostMenuId((current) => (current === postId ? null : postId));
    }

    return (
        <div className={`_layout _layout_main_wrapper ${isDarkTheme ? "_dark_wrapper" : ""}`}>
            <div className="_layout_mode_swithing_btn">
                <button
                    type="button"
                    className="_layout_swithing_btn_link"
                    onClick={toggleTheme}
                    aria-label={isDarkTheme ? "Switch to light mode" : "Switch to dark mode"}
                    title={isDarkTheme ? "Switch to light mode" : "Switch to dark mode"}
                >
                    <div className="_layout_swithing_btn">
                        <div className="_layout_swithing_btn_round"/>
                    </div>

                    <div className="_layout_change_btn_ic1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="16" fill="none" viewBox="0 0 11 16">
                            <path
                                fill="#fff"
                                d="M2.727 14.977l.04-.498-.04.498zm-1.72-.49l.489-.11-.489.11zM3.232 1.212L3.514.8l-.282.413zM9.792 8a6.5 6.5 0 00-6.5-6.5v-1a7.5 7.5 0 017.5 7.5h-1zm-6.5 6.5a6.5 6.5 0 006.5-6.5h1a7.5 7.5 0 01-7.5 7.5v-1zm-.525-.02c.173.013.348.02.525.02v1c-.204 0-.405-.008-.605-.024l.08-.997zm-.261-1.83A6.498 6.498 0 005.792 7h1a7.498 7.498 0 01-3.791 6.52l-.495-.87zM5.792 7a6.493 6.493 0 00-2.841-5.374L3.514.8A7.493 7.493 0 016.792 7h-1zm-3.105 8.476c-.528-.042-.985-.077-1.314-.155-.316-.075-.746-.242-.854-.726l.977-.217c-.028-.124-.145-.09.106-.03.237.056.6.086 1.165.131l-.08.997zm.314-1.956c-.622.354-1.045.596-1.31.792a.967.967 0 00-.204.185c-.01.013.027-.038.009-.12l-.977.218a.836.836 0 01.144-.666c.112-.162.27-.3.433-.42.324-.24.814-.519 1.41-.858L3 13.52zM3.292 1.5a.391.391 0 00.374-.285A.382.382 0 003.514.8l-.563.826A.618.618 0 012.702.95a.609.609 0 01.59-.45v1z"
                            />
                        </svg>
                    </div>

                    <div className="_layout_change_btn_ic2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="4.389" stroke="#fff" transform="rotate(-90 12 12)"/>
                            <path stroke="#fff" strokeLinecap="round"
                                  d="M3.444 12H1M23 12h-2.444M5.95 5.95L4.222 4.22M19.778 19.779L18.05 18.05M12 3.444V1M12 23v-2.445M18.05 5.95l1.728-1.729M4.222 19.779L5.95 18.05"/>
                        </svg>
                    </div>
                </button>
            </div>

            <div className="_main_layout">
                <FeedNavbar currentUser={currentUser}/>

                <div className="container _custom_container">
                    <div className="_layout_inner_wrap">
                        <div className="row">
                            <div className="col-xl-3 col-lg-3 col-md-12 col-sm-12">
                                <FeedLeftSidebar/>
                            </div>

                            <div className="col-xl-6 col-lg-6 col-md-12 col-sm-12">
                                <div className="_layout_middle_wrap">
                                    <div className="_layout_middle_inner">
                                        <FeedStoriesRow/>

                                        <form
                                            onSubmit={handleCreatePost}
                                            className="_feed_inner_text_area _b_radious6 _padd_b24 _padd_t24 _padd_r24 _padd_l24 _mar_b16"
                                        >
                                            {/*<div className="_feed_inner_text_area_box">
                                                <div className="_feed_inner_text_area_box_image">
                                                    <Avatar
                                                        name={currentUser.full_name}
                                                        imageUrl={currentUser.profile_image_url}
                                                        sizeClassName={"h-10 w-10"}
                                                        textClassName={"sm"}
                                                    />
                                                </div>

                                                <div className="form-floating _feed_inner_text_area_box_form w-100">
                                                    <textarea
                                                        id="feed-composer"
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
                                                        rows={3}
                                                    />
                                                    <label className="_feed_textarea_label flex" htmlFor="feed-composer">
                                                        <span>Write something ...</span>
                                                        <svg
                                                            style={{marginLeft: "5px"}}
                                                            className="inline-block shrink-0"
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            width="23"
                                                            height="24"
                                                            fill="none"
                                                            viewBox="0 0 23 24"
                                                        >
                                                            <path fill="#666"
                                                                  d="M19.504 19.209c.332 0 .601.289.601.646 0 .326-.226.596-.52.64l-.081.005h-6.276c-.332 0-.602-.289-.602-.645 0-.327.227-.597.52-.64l.082-.006h6.276zM13.4 4.417c1.139-1.223 2.986-1.223 4.125 0l1.182 1.268c1.14 1.223 1.14 3.205 0 4.427L9.82 19.649a2.619 2.619 0 01-1.916.85h-3.64c-.337 0-.61-.298-.6-.66l.09-3.941a3.019 3.019 0 01.794-1.982l8.852-9.5zm-.688 2.562l-7.313 7.85a1.68 1.68 0 00-.441 1.101l-.077 3.278h3.023c.356 0 .698-.133.968-.376l.098-.096 7.35-7.887-3.608-3.87zm3.962-1.65a1.633 1.633 0 00-2.423 0l-.688.737 3.606 3.87.688-.737c.631-.678.666-1.755.105-2.477l-.105-.124-1.183-1.268z"/>
                                                        </svg>
                                                    </label>
                                                </div>
                                            </div>*/}
                                            <div className="_feed_inner_text_area_box d-flex align-items-start gap-3">
                                                <div className="_feed_inner_text_area_box_image shrink-0">
                                                    <Avatar
                                                        name={currentUser.full_name}
                                                        imageUrl={currentUser.profile_image_url}
                                                        sizeClassName="h-10 w-10"
                                                        textClassName="sm"
                                                    />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="d-flex align-items-start justify-content-between gap-3">
                                                        <div className="form-floating _feed_inner_text_area_box_form flex-1 min-w-0">
                                                            <textarea
                                                                id="feed-composer"
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
                                                                rows={3}
                                                            />
                                                            {
                                                                composer.content.length == 0 && (
                                                                    <label className="_feed_textarea_label flex items-center" htmlFor="feed-composer">
                                                                        <span>Write something ...</span>
                                                                        <svg
                                                                            style={{marginLeft: "6px"}}
                                                                            className="inline-block shrink-0"
                                                                            xmlns="http://www.w3.org/2000/svg"
                                                                            width="23"
                                                                            height="24"
                                                                            fill="none"
                                                                            viewBox="0 0 23 24"
                                                                        >
                                                                            <path
                                                                                fill="#666"
                                                                                d="M19.504 19.209c.332 0 .601.289.601.646 0 .326-.226.596-.52.64l-.081.005h-6.276c-.332 0-.602-.289-.602-.645 0-.327.227-.597.52-.64l.082-.006h6.276zM13.4 4.417c1.139-1.223 2.986-1.223 4.125 0l1.182 1.268c1.14 1.223 1.14 3.205 0 4.427L9.82 19.649a2.619 2.619 0 01-1.916.85h-3.64c-.337 0-.61-.298-.6-.66l.09-3.941a3.019 3.019 0 01.794-1.982l8.852-9.5zm-.688 2.562l-7.313 7.85a1.68 1.68 0 00-.441 1.101l-.077 3.278h3.023c.356 0 .698-.133.968-.376l.098-.096 7.35-7.887-3.608-3.87zm3.962-1.65a1.633 1.633 0 00-2.423 0l-.688.737 3.606 3.87.688-.737c.631-.678.666-1.755.105-2.477l-.105-.124-1.183-1.268z"
                                                                            />
                                                                        </svg>
                                                                    </label>
                                                                )
                                                            }
                                                        </div>

                                                        <div className="shrink-0">
                                                            <select
                                                                className="w-fit text-slate-500 border rounded"
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
                                                    </div>
                                                </div>
                                            </div>

                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                className="d-none"
                                                onChange={handleImageSelect}
                                                disabled={isBusy}
                                            />

                                            {showComposerExtras || composerImagePreview ? (
                                                <div className="_mar_t20">
                                                    {composerImagePreview ? (
                                                        <div className="mb-3 overflow-hidden rounded-[12px] border border-slate-200 bg-slate-50 p-3">
                                                            <div className="relative overflow-hidden rounded-[10px]">
                                                                <Image
                                                                    src={composerImagePreview}
                                                                    alt="Selected image preview"
                                                                    width={900}
                                                                    height={560}
                                                                    unoptimized
                                                                    className="h-auto w-full object-cover"
                                                                />

                                                                <button
                                                                    type="button"
                                                                    onClick={handleRemoveSelectedImage}
                                                                    disabled={isBusy}
                                                                    aria-label="Remove selected image"
                                                                    style={{borderRadius: "9999px"}}
                                                                    className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-sm transition hover:bg-white"
                                                                >
                                                                    <svg
                                                                        xmlns="http://www.w3.org/2000/svg"
                                                                        width="16"
                                                                        height="16"
                                                                        fill="none"
                                                                        viewBox="0 0 16 16"
                                                                    >
                                                                        <path
                                                                            d="M4 4l8 8M12 4l-8 8"
                                                                            stroke="currentColor"
                                                                            strokeWidth="1.8"
                                                                            strokeLinecap="round"
                                                                        />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ) : null}

                                            <div className="_feed_inner_text_area_bottom">
                                                <div className="_feed_inner_text_area_item">
                                                    <div className="_feed_inner_text_area_bottom_photo _feed_common">
                                                        <button
                                                            type="button"
                                                            className="_feed_inner_text_area_bottom_photo_link"
                                                            onClick={() => fileInputRef.current?.click()}
                                                            disabled={isBusy}
                                                        >
                                                        <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none"
                                                                 viewBox="0 0 20 20">
                                                                <path fill="#666"
                                                                      d="M13.916 0c3.109 0 5.18 2.429 5.18 5.914v8.17c0 3.486-2.072 5.916-5.18 5.916H5.999C2.89 20 .827 17.572.827 14.085v-8.17C.827 2.43 2.897 0 6 0h7.917zm0 1.504H5.999c-2.321 0-3.799 1.735-3.799 4.41v8.17c0 2.68 1.472 4.412 3.799 4.412h7.917c2.328 0 3.807-1.734 3.807-4.411v-8.17c0-2.678-1.478-4.411-3.807-4.411zm.65 8.68l.12.125 1.9 2.147a.803.803 0 01-.016 1.063.642.642 0 01-.894.058l-.076-.074-1.9-2.148a.806.806 0 00-1.205-.028l-.074.087-2.04 2.717c-.722.963-2.02 1.066-2.86.26l-.111-.116-.814-.91a.562.562 0 00-.793-.07l-.075.073-1.4 1.617a.645.645 0 01-.97.029.805.805 0 01-.09-.977l.064-.086 1.4-1.617c.736-.852 1.95-.897 2.734-.137l.114.12.81.905a.587.587 0 00.861.033l.07-.078 2.04-2.718c.81-1.08 2.27-1.19 3.205-.275zM6.831 4.64c1.265 0 2.292 1.125 2.292 2.51 0 1.386-1.027 2.511-2.292 2.511S4.54 8.537 4.54 7.152c0-1.386 1.026-2.51 2.291-2.51zm0 1.504c-.507 0-.918.451-.918 1.007 0 .555.411 1.006.918 1.006.507 0 .919-.451.919-1.006 0-.556-.412-1.007-.919-1.007z"></path>
                                                            </svg>
                                                        </span>
                                                            {/*{isUploadingImage ? "Uploading..." : composer.image_url ? "Photo Added" : "Photo"}*/}
                                                            {composerImageFile ? "Photo Added" : "Photo"}
                                                        </button>
                                                    </div>

                                                    <div className="_feed_inner_text_area_bottom_video _feed_common">
                                                        <button
                                                            type="button"
                                                            className="_feed_inner_text_area_bottom_photo_link"
                                                            disabled
                                                            aria-disabled="true"
                                                        >
                    <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="24" fill="none" viewBox="0 0 22 24">
														<path fill="#666"
                                                              d="M11.485 4.5c2.213 0 3.753 1.534 3.917 3.784l2.418-1.082c1.047-.468 2.188.327 2.271 1.533l.005.141v6.64c0 1.237-1.103 2.093-2.155 1.72l-.121-.047-2.418-1.083c-.164 2.25-1.708 3.785-3.917 3.785H5.76c-2.343 0-3.932-1.72-3.932-4.188V8.688c0-2.47 1.589-4.188 3.932-4.188h5.726zm0 1.5H5.76C4.169 6 3.197 7.05 3.197 8.688v7.015c0 1.636.972 2.688 2.562 2.688h5.726c1.586 0 2.562-1.054 2.562-2.688v-.686-6.329c0-1.636-.973-2.688-2.562-2.688zM18.4 8.57l-.062.02-2.921 1.306v4.596l2.921 1.307c.165.073.343-.036.38-.215l.008-.07V8.876c0-.195-.16-.334-.326-.305z"></path>
													</svg>
                    </span>
                                                            Video
                                                        </button>
                                                    </div>

                                                    <div className="_feed_inner_text_area_bottom_event _feed_common">
                                                        <button
                                                            type="button"
                                                            className="_feed_inner_text_area_bottom_photo_link"
                                                            disabled
                                                            aria-disabled="true"
                                                        >
                    <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="24" fill="none" viewBox="0 0 22 24">
														<path fill="#666"
                                                              d="M14.371 2c.32 0 .585.262.627.603l.005.095v.788c2.598.195 4.188 2.033 4.18 5v8.488c0 3.145-1.786 5.026-4.656 5.026H7.395C4.53 22 2.74 20.087 2.74 16.904V8.486c0-2.966 1.596-4.804 4.187-5v-.788c0-.386.283-.698.633-.698.32 0 .584.262.626.603l.006.095v.771h5.546v-.771c0-.386.284-.698.633-.698zm3.546 8.283H4.004l.001 6.621c0 2.325 1.137 3.616 3.183 3.697l.207.004h7.132c2.184 0 3.39-1.271 3.39-3.63v-6.692zm-3.202 5.853c.349 0 .632.312.632.698 0 .353-.238.645-.546.691l-.086.006c-.357 0-.64-.312-.64-.697 0-.354.237-.645.546-.692l.094-.006zm-3.742 0c.35 0 .632.312.632.698 0 .353-.238.645-.546.691l-.086.006c-.357 0-.64-.312-.64-.697 0-.354.238-.645.546-.692l.094-.006zm-3.75 0c.35 0 .633.312.633.698 0 .353-.238.645-.547.691l-.093.006c-.35 0-.633-.312-.633-.697 0-.354.238-.645.547-.692l.094-.006zm7.492-3.615c.349 0 .632.312.632.697 0 .354-.238.645-.546.692l-.086.006c-.357 0-.64-.312-.64-.698 0-.353.237-.645.546-.691l.094-.006zm-3.742 0c.35 0 .632.312.632.697 0 .354-.238.645-.546.692l-.086.006c-.357 0-.64-.312-.64-.698 0-.353.238-.645.546-.691l.094-.006zm-3.75 0c.35 0 .633.312.633.697 0 .354-.238.645-.547.692l-.093.006c-.35 0-.633-.312-.633-.698 0-.353.238-.645.547-.691l.094-.006zm6.515-7.657H8.192v.895c0 .385-.283.698-.633.698-.32 0-.584-.263-.626-.603l-.006-.095v-.874c-1.886.173-2.922 1.422-2.922 3.6v.402h13.912v-.403c.007-2.181-1.024-3.427-2.914-3.599v.874c0 .385-.283.698-.632.698-.32 0-.585-.263-.627-.603l-.005-.095v-.895z"></path>
													</svg>
                    </span>
                                                            Event
                                                        </button>
                                                    </div>

                                                    <div className="_feed_inner_text_area_bottom_article _feed_common">
                                                        <button
                                                            type="button"
                                                            className="_feed_inner_text_area_bottom_photo_link"
                                                            onClick={() => setShowComposerExtras((current) => !current)}
                                                            disabled={isBusy}
                                                        >
                    <span className="_feed_inner_text_area_bottom_photo_iamge _mar_img">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="20" fill="none" viewBox="0 0 18 20">
														<path fill="#666"
                                                              d="M12.49 0c2.92 0 4.665 1.92 4.693 5.132v9.659c0 3.257-1.75 5.209-4.693 5.209H5.434c-.377 0-.734-.032-1.07-.095l-.2-.041C2 19.371.74 17.555.74 14.791V5.209c0-.334.019-.654.055-.96C1.114 1.564 2.799 0 5.434 0h7.056zm-.008 1.457H5.434c-2.244 0-3.381 1.263-3.381 3.752v9.582c0 2.489 1.137 3.752 3.38 3.752h7.049c2.242 0 3.372-1.263 3.372-3.752V5.209c0-2.489-1.13-3.752-3.372-3.752zm-.239 12.053c.36 0 .652.324.652.724 0 .4-.292.724-.652.724H5.656c-.36 0-.652-.324-.652-.724 0-.4.293-.724.652-.724h6.587zm0-4.239a.643.643 0 01.632.339.806.806 0 010 .78.643.643 0 01-.632.339H5.656c-.334-.042-.587-.355-.587-.729s.253-.688.587-.729h6.587zM8.17 5.042c.335.041.588.355.588.729 0 .373-.253.687-.588.728H5.665c-.336-.041-.589-.355-.589-.728 0-.374.253-.688.589-.729H8.17z"></path>
													  </svg>
                    </span>
                                                            Article
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="_feed_inner_text_area_btn">
                                                    <button
                                                        type="submit"
                                                        className="_feed_inner_text_area_btn_link"
                                                        disabled={isBusy}
                                                    >
                                                        <svg className="_mar_img" xmlns="http://www.w3.org/2000/svg" width="14" height="13"
                                                             fill="none" viewBox="0 0 14 13">
                                                            <path fill="#fff" fillRule="evenodd"
                                                                  d="M6.37 7.879l2.438 3.955a.335.335 0 00.34.162c.068-.01.23-.05.289-.247l3.049-10.297a.348.348 0 00-.09-.35.341.341 0 00-.34-.088L1.75 4.03a.34.34 0 00-.247.289.343.343 0 00.16.347L5.666 7.17 9.2 3.597a.5.5 0 01.712.703L6.37 7.88zM9.097 13c-.464 0-.89-.236-1.14-.641L5.372 8.165l-4.237-2.65a1.336 1.336 0 01-.622-1.331c.074-.536.441-.96.957-1.112L11.774.054a1.347 1.347 0 011.67 1.682l-3.05 10.296A1.332 1.332 0 019.098 13z"
                                                                  clipRule="evenodd"></path>
                                                        </svg>
                                                        <span>{isCreating ? "Posting..." : "Post"}</span>
                                                    </button>
                                                </div>
                                            </div>

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

                                        {posts.map((post) => {
                                            const authorInitials = getInitials(post.author.full_name);
                                            const isCommentsOpen = Boolean(openComments[post.id]);
                                            const visibilityLabel = post.visibility === "private" ? "Private" : "Public";
                                            const visibleLikers = post.likers_preview.slice(0, 3);
                                            const remainingLikers = Math.max(post.like_count - visibleLikers.length, 0);

                                            return (
                                                <article
                                                    key={post.id}
                                                    className="_feed_inner_timeline_post_area _b_radious6 _padd_b24 _padd_t24 _mar_b16"
                                                >
                                                    <div className="_feed_inner_timeline_content _padd_r24 _padd_l24">
                                                        <div className="_feed_inner_timeline_post_top">
                                                            <div className="_feed_inner_timeline_post_box">
                                                                <div className="_feed_inner_timeline_post_box_image">
                                                                    {
                                                                        post.author.profile_image_url ?
                                                                            <Avatar
                                                                                name={authorInitials}
                                                                                imageUrl={post.author.profile_image_url}
                                                                                sizeClassName="h-11 w-11"
                                                                                textClassName="sm"
                                                                            />
                                                                            :
                                                                            <div
                                                                                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#377DFF] text-sm font-semibold uppercase text-white">
                                                                                {authorInitials}
                                                                            </div>
                                                                    }
                                                                </div>

                                                                <div className="_feed_inner_timeline_post_box_txt">
                                                                    <h4 className="_feed_inner_timeline_post_box_title">
                                                                        {post.author.full_name}
                                                                    </h4>

                                                                    <p className="_feed_inner_timeline_post_box_para">
                                                                        {formatRelativeTime(post.created_at)} .{" "}
                                                                        <a
                                                                            href="#0"
                                                                            onClick={(event) => event.preventDefault()}
                                                                        >
                                                                            {visibilityLabel}
                                                                        </a>
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="_feed_inner_timeline_post_box_dropdown">
                                                                <div className="_feed_timeline_post_dropdown">
                                                                    <button
                                                                        type="button"
                                                                        className="_feed_timeline_post_dropdown_link"
                                                                        aria-label="Post options"
                                                                        onClick={() => togglePostMenu(post.id)}
                                                                    >
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="4" height="17" fill="none"
                                                                             viewBox="0 0 4 17">
                                                                            <circle cx="2" cy="2" r="2" fill="#C4C4C4"/>
                                                                            <circle cx="2" cy="8" r="2" fill="#C4C4C4"/>
                                                                            <circle cx="2" cy="15" r="2" fill="#C4C4C4"/>
                                                                        </svg>
                                                                    </button>
                                                                </div>

                                                                <div
                                                                    className={`_feed_timeline_dropdown border border-gray-200 dark:border-gray-300 ${
                                                                        openPostMenuId === post.id ? "show" : ""
                                                                    }`}
                                                                >
                                                                    <ul className="_feed_timeline_dropdown_list">
                                                                        <li className="_feed_timeline_dropdown_item">
                                                                            <button
                                                                                type="button"
                                                                                className="_feed_timeline_dropdown_link flex gap-2 items-center border-0 bg-transparent text-start w-100"
                                                                            >
                                                                                <span>
                                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                                                                                         fill="none" viewBox="0 0 18 18">
                                                                                    <path
                                                                                        stroke="#1890FF"
                                                                                        strokeLinecap="round"
                                                                                        strokeLinejoin="round"
                                                                                        strokeWidth="1.2"
                                                                                        d="M14.25 15.75L9 12l-5.25 3.75v-12a1.5 1.5 0 011.5-1.5h7.5a1.5 1.5 0 011.5 1.5v12z"
                                                                                    />
                                                                                </svg>
                                                                                </span>
                                                                                <div>Save Post</div>
                                                                            </button>
                                                                        </li>

                                                                        <li className="_feed_timeline_dropdown_item">
                                                                            <button
                                                                                type="button"
                                                                                className="_feed_timeline_dropdown_link flex gap-2 items-center border-0 bg-transparent text-start w-100"
                                                                            >
                    <span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="22" fill="none" viewBox="0 0 20 22">
                            <path
                                fill="#377DFF"
                                fillRule="evenodd"
                                d="M7.547 19.55c.533.59 1.218.915 1.93.915.714 0 1.403-.324 1.938-.916a.777.777 0 011.09-.056c.318.284.344.77.058 1.084-.832.917-1.927 1.423-3.086 1.423h-.002c-1.155-.001-2.248-.506-3.077-1.424a.762.762 0 01.057-1.083.774.774 0 011.092.057zM9.527 0c4.58 0 7.657 3.543 7.657 6.85 0 1.702.436 2.424.899 3.19.457.754.976 1.612.976 3.233-.36 4.14-4.713 4.478-9.531 4.478-4.818 0-9.172-.337-9.528-4.413-.003-1.686.515-2.544.973-3.299l.161-.27c.398-.679.737-1.417.737-2.918C1.871 3.543 4.948 0 9.528 0zm0 1.535c-3.6 0-6.11 2.802-6.11 5.316 0 2.127-.595 3.11-1.12 3.978-.422.697-.755 1.247-.755 2.444.173 1.93 1.455 2.944 7.986 2.944 6.494 0 7.817-1.06 7.988-3.01-.003-1.13-.336-1.681-.757-2.378-.526-.868-1.12-1.851-1.12-3.978 0-2.514-2.51-5.316-6.111-5.316z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </span>
                                                                                <div>Turn On Notification</div>
                                                                            </button>
                                                                        </li>

                                                                        <li className="_feed_timeline_dropdown_item">
                                                                            <button
                                                                                type="button"
                                                                                className="_feed_timeline_dropdown_link flex gap-2 items-center border-0 bg-transparent text-start w-100"
                                                                            >
                    <span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 18 18">
                            <path
                                stroke="#1890FF"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.2"
                                d="M14.25 2.25H3.75a1.5 1.5 0 00-1.5 1.5v10.5a1.5 1.5 0 001.5 1.5h10.5a1.5 1.5 0 001.5-1.5V3.75a1.5 1.5 0 00-1.5-1.5zM6.75 6.75l4.5 4.5M11.25 6.75l-4.5 4.5"
                            />
                        </svg>
                    </span>
                                                                                <div>Hide</div>
                                                                            </button>
                                                                        </li>

                                                                        <li className="_feed_timeline_dropdown_item">
                                                                            <button
                                                                                type="button"
                                                                                className="_feed_timeline_dropdown_link flex gap-2 items-center border-0 bg-transparent text-start w-100"
                                                                            >
                    <span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 18 18">
                            <path
                                stroke="#1890FF"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.2"
                                d="M8.25 3H3a1.5 1.5 0 00-1.5 1.5V15A1.5 1.5 0 003 16.5h10.5A1.5 1.5 0 0015 15V9.75"
                            />
                            <path
                                stroke="#1890FF"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.2"
                                d="M13.875 1.875a1.591 1.591 0 112.25 2.25L9 11.25 6 12l.75-3 7.125-7.125z"
                            />
                        </svg>
                    </span>
                                                                                <div>Edit Post</div>
                                                                            </button>
                                                                        </li>

                                                                        <li className="_feed_timeline_dropdown_item">
                                                                            <button
                                                                                type="button"
                                                                                className="_feed_timeline_dropdown_link flex gap-2 items-center border-0 bg-transparent text-start w-100"
                                                                            >
                    <span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 18 18">
                            <path
                                stroke="#1890FF"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.2"
                                d="M2.25 4.5h13.5M6 4.5V3a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0112 3v1.5m2.25 0V15a1.5 1.5 0 01-1.5 1.5h-7.5a1.5 1.5 0 01-1.5-1.5V4.5h10.5zM7.5 8.25v4.5M10.5 8.25v4.5"
                            />
                        </svg>
                    </span>
                                                                                <div>Delete Post</div>
                                                                            </button>
                                                                        </li>
                                                                    </ul>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <h4 className="_feed_inner_timeline_post_title whitespace-pre-line">
                                                            {post.content}
                                                        </h4>

                                                        {post.image_url ? (
                                                            <div className="_feed_inner_timeline_image">
                                                                <Image
                                                                    src={post.image_url}
                                                                    alt="Post image"
                                                                    className="_time_img h-auto w-full"
                                                                    width={900}
                                                                    height={560}
                                                                    loading="eager"
                                                                />
                                                            </div>
                                                        ) : null}
                                                    </div>

                                                    <div className="_feed_inner_timeline_total_reacts _padd_r24 _padd_l24 _mar_b26">
                                                        <button
                                                            type="button"
                                                            className="_feed_inner_timeline_total_reacts_image border-0 bg-transparent p-0"
                                                            onClick={() =>
                                                                setLikerModal({
                                                                    isOpen: true,
                                                                    title: "People who liked this post",
                                                                    endpoint: `/api/proxy/posts/${post.id}/likes`,
                                                                })
                                                            }
                                                        >

                                                            {post.like_count > 0 ? (
                                                                <>
                                                                    {visibleLikers.map((user, index) => (
                                                                        <div
                                                                            key={user.id}
                                                                            className={`${
                                                                                index === 0 ? "_react_img1" : "_react_img"
                                                                            } inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white bg-white`}
                                                                        >
                                                                            <Avatar
                                                                                name={user.full_name}
                                                                                imageUrl={user.profile_image_url}
                                                                                sizeClassName="h-full w-full"
                                                                                textClassName="text-[10px]"
                                                                            />
                                                                        </div>
                                                                    ))}

                                                                    {remainingLikers > 0 ? (
                                                                        <p className="_feed_inner_timeline_total_reacts_para">
                                                                            {remainingLikers}+
                                                                        </p>
                                                                    ) : null}
                                                                </>
                                                            ) : (
                                                                <p
                                                                    className="_feed_inner_timeline_total_reacts_para"
                                                                    style={{marginLeft: 0}}
                                                                >
                                                                    0
                                                                </p>
                                                            )}

                                                        </button>

                                                        <div className="_feed_inner_timeline_total_reacts_txt">
                                                            <p className="_feed_inner_timeline_total_reacts_para1">
                                                                <a
                                                                    href="#0"
                                                                    onClick={(event) => {
                                                                        event.preventDefault();
                                                                        toggleComments(post.id);
                                                                    }}
                                                                >
                                                                    <span>{post.comment_count}</span> Comment
                                                                </a>
                                                            </p>

                                                            <p className="_feed_inner_timeline_total_reacts_para2">
                                                                <span>0</span> Share
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="_feed_inner_timeline_reaction">
                                                        <button
                                                            type="button"
                                                            className={`_feed_inner_timeline_reaction_emoji _feed_reaction ${
                                                                post.liked_by_me ? "_feed_reaction_active" : ""
                                                            }`}
                                                            onClick={() => void handleTogglePostLike(post.id, post.liked_by_me)}
                                                        >
                    <span className="_feed_inner_timeline_reaction_link">
                        <span className="inline-flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" fill="none" viewBox="0 0 19 19">
                                <path fill="#FFCC4D" d="M9.5 19a9.5 9.5 0 100-19 9.5 9.5 0 000 19z"/>
                                <path fill="#664500"
                                      d="M9.5 11.083c-1.912 0-3.181-.222-4.75-.527-.358-.07-1.056 0-1.056 1.055 0 2.111 2.425 4.75 5.806 4.75 3.38 0 5.805-2.639 5.805-4.75 0-1.055-.697-1.125-1.055-1.055-1.57.305-2.838.527-4.75.527z"/>
                                <path fill="#fff"
                                      d="M4.75 11.611s1.583.528 4.75.528 4.75-.528 4.75-.528-1.056 2.111-4.75 2.111-4.75-2.11-4.75-2.11z"/>
                                <path fill="#664500"
                                      d="M6.333 8.972c.729 0 1.32-.827 1.32-1.847s-.591-1.847-1.32-1.847c-.729 0-1.32.827-1.32 1.847s.591 1.847 1.32 1.847zM12.667 8.972c.729 0 1.32-.827 1.32-1.847s-.591-1.847-1.32-1.847c-.729 0-1.32.827-1.32 1.847s.591 1.847 1.32 1.847z"/>
                            </svg>
                            {post.liked_by_me ? "Liked" : "Like"}
                        </span>
                    </span>
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="_feed_inner_timeline_reaction_comment _feed_reaction"
                                                            onClick={() => toggleComments(post.id)}
                                                        >
                    <span className="_feed_inner_timeline_reaction_link">
                        <span className="inline-flex items-center gap-2">
                            <svg className="_reaction_svg" xmlns="http://www.w3.org/2000/svg" width="21" height="21" fill="none" viewBox="0 0 21 21">
                                <path stroke="#000"
                                      d="M1 10.5c0-.464 0-.696.009-.893A9 9 0 019.607 1.01C9.804 1 10.036 1 10.5 1v0c.464 0 .696 0 .893.009a9 9 0 018.598 8.598c.009.197.009.429.009.893v6.046c0 1.36 0 2.041-.317 2.535a2 2 0 01-.602.602c-.494.317-1.174.317-2.535.317H10.5c-.464 0-.696 0-.893-.009a9 9 0 01-8.598-8.598C1 11.196 1 10.964 1 10.5v0z"/>
                                <path stroke="#000" strokeLinecap="round" strokeLinejoin="round" d="M6.938 9.313h7.125M10.5 14.063h3.563"/>
                            </svg>
                            {isCommentsOpen ? "Hide comments" : "Comment"}
                        </span>
                    </span>
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="_feed_inner_timeline_reaction_share _feed_reaction"
                                                        >
                    <span className="_feed_inner_timeline_reaction_link">
                        <span className="inline-flex items-center gap-2">
                            <svg className="_reaction_svg" xmlns="http://www.w3.org/2000/svg" width="24" height="21" fill="none" viewBox="0 0 24 21">
                                <path stroke="#000" strokeLinejoin="round"
                                      d="M23 10.5L12.917 1v5.429C3.267 6.429 1 13.258 1 20c2.785-3.52 5.248-5.429 11.917-5.429V20L23 10.5z"/>
                            </svg>
                            Share
                        </span>
                    </span>
                                                        </button>
                                                    </div>

                                                    {
                                                        isCommentsOpen ? (
                                                            <div className="_feed_inner_timeline_cooment_area">
                                                                <PostComments
                                                                    postId={post.id}
                                                                    currentUser={currentUser}
                                                                    onCommentCreated={() => incrementCommentCount(post.id)}
                                                                />
                                                            </div>
                                                        ) : null
                                                    }
                                                </article>
                                            )
                                                ;
                                        })}

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

                            <div className="col-xl-3 col-lg-3 col-md-12 col-sm-12">
                                <FeedRightSidebar/>
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
