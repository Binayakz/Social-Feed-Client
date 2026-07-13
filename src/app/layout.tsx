/* eslint-disable @next/next/no-page-custom-font, @next/next/no-css-tags */
import type {Metadata} from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Buddy Script",
    description: "Social Feed frontend",
    icons: {
        icon: "/assets/images/logo-copy.svg",
    },
};

export default function RootLayout({children,}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="h-full scroll-smooth">
        <head>
            <link rel="preconnect" href="https://fonts.googleapis.com"/>
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin=""/>
            <link
                href="https://fonts.googleapis.com/css2?family=Poppins:wght@100;300;400;500;600;700;800&display=swap"
                rel="stylesheet"
            />

            <link rel="stylesheet" href="/assets/css/bootstrap.min.css"/>
            <link rel="stylesheet" href="/assets/css/common.css"/>
            <link rel="stylesheet" href="/assets/css/main.css"/>
            <link rel="stylesheet" href="/assets/css/responsive.css"/>
        </head>

        <body className="min-h-full bg-[#f3f7fb] text-slate-900 antialiased">
        {children}
        </body>
        </html>
    );
}
