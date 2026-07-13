import "./globals.css";
import {Metadata} from "next";
import React from "react";


export const metadata: Metadata = {
    title: "Buddy Script",
    description: "Social feed frontend built with Next.js.",
    icons: {
        icon: "/assets/images/logo-copy.svg",
    },
};

export default function RootLayout({children,}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="h-full scroll-smooth" data-scroll-behavior="smooth">
        <head></head>
        <body className="min-h-full bg-[#f3f7fb] text-slate-900 antialiased">
        {children}
        </body>
        </html>
    );
}

