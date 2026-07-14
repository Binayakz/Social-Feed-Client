export type UUID = string;
export type ISODateString = string;
export type Visibility = "public" | "private";

export interface ApiErrorResponse {
    detail: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
}

export interface TokenResponse {
    access_token: string;
    token_type: "bearer";
}

export interface TokenPayload {
    sub: UUID;
    exp: number;
}

export interface UserResponse {
    id: UUID;
    first_name: string;
    last_name: string;
    full_name: string;
    email: string;
    profile_image_url: string | null;
    is_active: boolean;
    created_at: ISODateString;
    updated_at: ISODateString;
}

export interface PostAuthorResponse {
    id: UUID;
    first_name: string;
    last_name: string;
    full_name: string;
    profile_image_url: string | null;
}

export interface PostCreate {
    content: string;
    image_url?: string | null;
    visibility?: Visibility;
}

export interface PostLikerPreview {
    id: UUID;
    full_name: string;
    initials: string;
    profile_image_url: string | null;
}

export interface PostResponse {
    id: UUID;
    author_id: UUID;
    content: string;
    image_url: string | null;
    visibility: Visibility;
    author: PostAuthorResponse;
    like_count: number;
    comment_count: number;
    liked_by_me: boolean;
    likers_preview: PostLikerPreview[];
    created_at: ISODateString;
    updated_at: ISODateString;
}

export interface PostFeedPage {
    items: PostResponse[];
    next_cursor: string | null;
    has_more: boolean;
}

export interface CommentAuthorResponse {
    id: UUID;
    first_name: string;
    last_name: string;
    full_name: string;
    profile_image_url: string | null;
}

export interface CommentCreate {
    content: string;
    parent_id?: UUID | null;
}

export interface ReplyResponse {
    id: UUID;
    post_id: UUID;
    author_id: UUID;
    parent_id: UUID | null;
    content: string;
    author: CommentAuthorResponse;
    like_count: number;
    liked_by_me: boolean;
    created_at: ISODateString;
    updated_at: ISODateString;
}

export interface CommentResponse {
    id: UUID;
    post_id: UUID;
    author_id: UUID;
    parent_id: UUID | null;
    content: string;
    author: CommentAuthorResponse;
    like_count: number;
    liked_by_me: boolean;
    replies: ReplyResponse[];
    created_at: ISODateString;
    updated_at: ISODateString;
}

export interface CommentPage {
    items: CommentResponse[];
    next_cursor: string | null;
    has_more: boolean;
}

export interface LikeUserResponse {
    id: UUID;
    first_name: string;
    last_name: string;
    full_name: string;
    profile_image_url: string | null;
}

export interface LikeActionResponse {
    liked: boolean;
    count: number;
}

export interface LikeListResponse {
    count: number;
    users: LikeUserResponse[];
}

export interface UploadedImageResponse {
    key: string;
    url: string;
    content_type: string;
    size: number;
}
