"use client";

import type {FormEvent} from "react";
import {useState, useTransition} from "react";

import {useRouter} from "next/navigation";

import type {ApiErrorResponse, LoginRequest} from "@/lib/types";

async function getErrorMessage(response: Response): Promise<string> {
    try {
        const data = (await response.json()) as ApiErrorResponse;
        return data.detail || "Unable to sign in.";
    } catch {
        return "Unable to sign in.";
    }
}

export default function LoginForm() {
    const router = useRouter();
    const [isRedirecting, startTransition] = useTransition();

    const [form, setForm] = useState<LoginRequest>({
        email: "",
        password: "",
    });
    const [rememberMe, setRememberMe] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isBusy = isSubmitting || isRedirecting;

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            const payload: LoginRequest = {
                email: form.email.trim().toLowerCase(),
                password: form.password,
            };

            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(await getErrorMessage(response));
            }

            startTransition(() => {
                router.replace("/feed");
                router.refresh();
            });
        } catch (submitError) {
            setError(
                submitError instanceof Error ? submitError.message : "Unable to sign in.",
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <>
            <form className="_social_login_form" onSubmit={handleSubmit}>
                <div className="row">
                    <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12">
                        <div className="_social_login_form_input _mar_b14">
                            <label htmlFor="login-email" className="_social_login_label _mar_b8">
                                Email
                            </label>
                            <input
                                id="login-email"
                                type="email"
                                className="form-control _social_login_input"
                                // placeholder="Enter your email"
                                autoComplete="email"
                                value={form.email}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        email: event.target.value,
                                    }))
                                }
                                disabled={isBusy}
                                required
                            />
                        </div>
                    </div>

                    <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12">
                        <div className="_social_login_form_input _mar_b14">
                            <label htmlFor="login-password" className="_social_login_label _mar_b8">
                                Password
                            </label>
                            <input
                                id="login-password"
                                type="password"
                                className="form-control _social_login_input"
                                // placeholder="Enter your password"
                                autoComplete="current-password"
                                minLength={8}
                                value={form.password}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        password: event.target.value,
                                    }))
                                }
                                disabled={isBusy}
                                required
                            />
                        </div>
                    </div>
                </div>

                <div className="row">
                    <div className="col-lg-6 col-xl-6 col-md-6 col-sm-12">
                        <div className="form-check _social_login_form_check">
                            <input
                                id="rememberMe"
                                className="form-check-input _social_login_form_check_input"
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(event) => setRememberMe(event.target.checked)}
                                disabled={isBusy}
                            />
                            <label
                                className="form-check-label _social_login_form_check_label"
                                htmlFor="rememberMe"
                            >
                                Remember me
                            </label>
                        </div>
                    </div>

                    <div className="col-lg-6 col-xl-6 col-md-6 col-sm-12">
                        <div className="_social_login_form_left">
                            <p className="_social_login_form_left_para">Forgot password?</p>
                        </div>
                    </div>
                </div>

                {error ? (
                    <div className="row">
                        <div className="col-lg-12 col-md-12 col-xl-12 col-sm-12">
                            <div className="alert alert-danger _mar_t20 _mar_b0" role="alert">
                                {error}
                            </div>
                        </div>
                    </div>
                ) : null}

                <div className="row">
                    <div className="col-lg-12 col-md-12 col-xl-12 col-sm-12">
                        <div className="_social_login_form_btn _mar_t40 _mar_b60">
                            <button
                                type="submit"
                                className="_social_login_form_btn_link _btn1"
                                disabled={isBusy}
                            >
                                {isBusy ? "Logging in..." : "Login now"}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </>
    );
}
