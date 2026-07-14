import type {NextConfig} from "next";

const nextConfig: NextConfig = {
    /* config options here */
    devIndicators: false,
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "social-feed-assets.s3.ap-south-1.amazonaws.com",
                pathname: "/post-images/**",
            },
            {
                protocol: "https",
                hostname: "social-feed-assets.s3.ap-south-1.amazonaws.com",
                pathname: "/profile-images/**",
            },
        ],
    },
};

export default nextConfig;
