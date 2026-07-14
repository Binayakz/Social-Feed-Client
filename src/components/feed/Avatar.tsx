import Image from "next/image";

function getInitials(fullName: string): string {
    return fullName
        .split(" ")
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
}

type AvatarProps = {
    name: string;
    imageUrl?: string | null;
    sizeClassName?: string;
    textClassName?: string;
};

export function Avatar({
                           name,
                           imageUrl,
                           sizeClassName = "h-10 w-10",
                           textClassName = "text-xs",
                       }: AvatarProps) {
    return (
        <div
            className={`flex items-center justify-center overflow-hidden rounded-full bg-[#377DFF] font-semibold uppercase text-white ${sizeClassName} ${textClassName}`}
        >
            {imageUrl ? (
                <Image
                    src={imageUrl}
                    alt={name}
                    width={80}
                    height={80}
                    className="h-full w-full object-cover"
                />
            ) : (
                getInitials(name)
            )}
        </div>
    );
}
