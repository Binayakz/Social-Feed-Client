import Link from "next/link";

import AuthShell from "@/components/auth/auth-shell";
import {redirectIfAuthenticated} from "@/lib/session";
import RegisterForm from "@/components/auth/register-form";

export default async function RegisterPage() {
    await redirectIfAuthenticated();

    return (
        <AuthShell
            mode="registration"
            subtitle="Get Started Now"
            title="Registration"
            imageSrc="/assets/images/registration.png"
            secondaryImageSrc="/assets/images/registration1.png"
            imageAlt="Registration illustration"
        >
            <RegisterForm/>

            <div className="row">
                <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12">
                    <div className="_social_registration_bottom_txt">
                        <p className="_social_registration_bottom_txt_para">
                            Already have an account? <Link href="/login">Login now</Link>
                        </p>
                    </div>
                </div>
            </div>
        </AuthShell>
    );
}
