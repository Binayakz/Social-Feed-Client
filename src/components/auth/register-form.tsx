"use client";

import type {FormEvent} from "react";
import {useState, useTransition} from "react";

import {useRouter} from "next/navigation";

import type {ApiErrorResponse, RegisterRequest} from "@/lib/types";

type RegisterFormState = RegisterRequest & {
    confirmPassword: string;
    agreedToTerms: boolean;
};

async function getErrorMessage(response: Response): Promise<string> {
    try {
        const data = (await response.json()) as ApiErrorResponse;
        return data.detail || "Unable to register user.";
    } catch {
        return "Unable to register user.";
    }
}

export default function RegisterForm() {
    const router = useRouter();
    const [isRedirecting, startTransition] = useTransition();

    const [form, setForm] = useState<RegisterFormState>({
        first_name: "",
        last_name: "",
        email: "",
        password: "",
        confirmPassword: "",
        agreedToTerms: false,
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isBusy = isSubmitting || isRedirecting;

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        const firstName = form.first_name.trim();
        const lastName = form.last_name.trim();
        const email = form.email.trim().toLowerCase();

        if (!firstName || !lastName) {
            setError("First name and last name are required.");
            return;
        }

        if (form.password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        if (form.password !== form.confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (!form.agreedToTerms) {
            setError("You must agree to the terms and conditions.");
            return;
        }

        setIsSubmitting(true);

        try {
            const payload: RegisterRequest = {
                first_name: firstName,
                last_name: lastName,
                email,
                password: form.password,
            };

            const response = await fetch("/api/auth/register", {
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
                submitError instanceof Error
                    ? submitError.message
                    : "Unable to register user.",
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <>
            <form className="_social_registration_form" onSubmit={handleSubmit}>
                <div className="row">
                    <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12">
                        <div className="_social_registration_form_input _mar_b14">
                            <label
                                htmlFor="register-first-name"
                                className="_social_registration_label _mar_b8"
                            >
                                First Name
                            </label>
                            <input
                                id="register-first-name"
                                type="text"
                                className="form-control _social_registration_input"
                                // placeholder="Enter first name"
                                autoComplete="given-name"
                                value={form.first_name}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        first_name: event.target.value,
                                    }))
                                }
                                disabled={isBusy}
                                required
                            />
                        </div>
                    </div>

                    <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12">
                        <div className="_social_registration_form_input _mar_b14">
                            <label
                                htmlFor="register-last-name"
                                className="_social_registration_label _mar_b8"
                            >
                                Last Name
                            </label>
                            <input
                                id="register-last-name"
                                type="text"
                                className="form-control _social_registration_input"
                                // placeholder="Enter last name"
                                autoComplete="family-name"
                                value={form.last_name}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        last_name: event.target.value,
                                    }))
                                }
                                disabled={isBusy}
                                required
                            />
                        </div>
                    </div>

                    <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12">
                        <div className="_social_registration_form_input _mar_b14">
                            <label
                                htmlFor="register-email"
                                className="_social_registration_label _mar_b8"
                            >
                                Email
                            </label>
                            <input
                                id="register-email"
                                type="email"
                                className="form-control _social_registration_input"
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
                        <div className="_social_registration_form_input _mar_b14">
                            <label
                                htmlFor="register-password"
                                className="_social_registration_label _mar_b8"
                            >
                                Password
                            </label>
                            <input
                                id="register-password"
                                type="password"
                                className="form-control _social_registration_input"
                                // placeholder="Enter your password"
                                autoComplete="new-password"
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

                    <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12">
                        <div className="_social_registration_form_input _mar_b14">
                            <label
                                htmlFor="register-confirm-password"
                                className="_social_registration_label _mar_b8"
                            >
                                Repeat Password
                            </label>
                            <input
                                id="register-confirm-password"
                                type="password"
                                className="form-control _social_registration_input"
                                // placeholder="Repeat your password"
                                autoComplete="new-password"
                                minLength={8}
                                value={form.confirmPassword}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        confirmPassword: event.target.value,
                                    }))
                                }
                                disabled={isBusy}
                                required
                            />
                        </div>
                    </div>
                </div>

                <div className="row">
                    <div className="col-lg-12 col-xl-12 col-md-12 col-sm-12">
                        <div className="form-check _social_registration_form_check">
                            <input
                                id="agreeTerms"
                                className="form-check-input _social_registration_form_check_input"
                                type="checkbox"
                                checked={form.agreedToTerms}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        agreedToTerms: event.target.checked,
                                    }))
                                }
                                disabled={isBusy}
                            />
                            <label
                                className="form-check-label _social_registration_form_check_label"
                                htmlFor="agreeTerms"
                            >
                                I agree to terms &amp; conditions
                            </label>
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
                        <div className="_social_registration_form_btn _mar_t40 _mar_b60">
                            <button
                                type="submit"
                                className="_social_registration_form_btn_link _btn1 border-2 border-white flex justify-center w-full whitespace-nowrap"
                                disabled={isBusy}
                            >
                                {isBusy ? "Creating account..." : "Register now"}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </>
    );
}
