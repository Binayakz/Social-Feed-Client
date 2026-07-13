type ProfileSummaryCardProps = {
    fullName: string;
    email: string;
    isActive: boolean;
    createdAt: string;
};

export default function ProfileSummaryCard({
                                               fullName,
                                               email,
                                               isActive,
                                               createdAt,
                                           }: ProfileSummaryCardProps) {
    const joinedDate = new Date(createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });

    return (
        <div className="_feed_inner_timeline_post_area _b_radious6 _padd_b24 _padd_t24 _mar_b16">
            <div className="_feed_inner_timeline_content _padd_r24 _padd_l24">
                <h4 className="_feed_inner_timeline_post_title">Your Profile</h4>

                <div className="mt-4 rounded-4 border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-2 text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">Name:</span> {fullName}
                    </p>
                    <p className="mb-2 text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">Email:</span> {email}
                    </p>
                    <p className="mb-2 text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">Status:</span>{" "}
                        {isActive ? "Active" : "Inactive"}
                    </p>
                    <p className="mb-0 text-sm text-slate-700">
                        <span className="font-semibold text-slate-900">Joined:</span> {joinedDate}
                    </p>
                </div>
            </div>
        </div>
    );
}
