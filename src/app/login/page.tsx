import Link from "next/link";

import AuthShell from "@/components/auth/auth-shell";
import {redirectIfAuthenticated} from "@/lib/session";
import LoginForm from "@/components/auth/login-form";

export default async function LoginPage() {
    await redirectIfAuthenticated();

    return (
        <AuthShell
            mode="login"
            subtitle="Welcome back"
            title="Login to your account"
            imageSrc="/assets/images/login.png"
            imageAlt="Login illustration"
        >
            <LoginForm/>

            <div className="row">
                <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12">
                    <div className="_social_login_bottom_txt">
                        <p className="_social_login_bottom_txt_para">
                            Dont have an account? <Link href="/register">Create New Account</Link>
                        </p>
                    </div>
                </div>
            </div>
        </AuthShell>
    );
}
